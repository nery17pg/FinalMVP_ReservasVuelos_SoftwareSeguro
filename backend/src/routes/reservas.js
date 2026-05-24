const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { PrismaClient } = require('@prisma/client');
const { auth, authorizeRoles } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Helper: verificar y marcar reservas expiradas sin cron job
// Se llama al momento de consultar (lazy expiration)
async function checkExpiracion(reservaId) {
  const reserva = await prisma.reserva.findUnique({ where: { id: reservaId } });
  if (!reserva) return null;
  if (reserva.estado === 'PENDIENTE' && new Date() > reserva.expiresAt) {
    // Devolver asientos al vuelo
    await prisma.vuelo.update({
      where: { id: reserva.vueloId },
      data: { asientosDisponibles: { increment: 1 } },
    });
    return prisma.reserva.update({
      where: { id: reservaId },
      data: { estado: 'EXPIRADA' },
    });
  }
  return reserva;
}

// GET /api/reservas → mis reservas (CLIENT) o todas (ADMIN)
router.get('/', auth, async (req, res) => {
  try {
    const where = req.user.role === 'CLIENT' ? { usuarioId: req.user.id } : {};
    const reservas = await prisma.reserva.findMany({
      where,
      include: {
        vuelo: { select: { origen: true, destino: true, fechaSalida: true } },
        pago: { select: { folio: true, estado: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Lazy expiration: revisar cada reserva pendiente
    const actualizadas = await Promise.all(
      reservas.map(async (r) => {
        if (r.estado === 'PENDIENTE' && new Date() > r.expiresAt) {
          await prisma.vuelo.update({
            where: { id: r.vueloId },
            data: { asientosDisponibles: { increment: 1 } },
          });
          return prisma.reserva.update({
            where: { id: r.id },
            data: { estado: 'EXPIRADA' },
            include: {
              vuelo: { select: { origen: true, destino: true, fechaSalida: true } },
              pago: { select: { folio: true, estado: true } },
            },
          });
        }
        return r;
      })
    );

    res.json({ reservas: actualizadas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/reservas → crear reserva
router.post('/', auth, authorizeRoles('CLIENT'), [
  body('vueloId').isInt(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Datos inválidos' });

  const { vueloId } = req.body;
  try {
    const vuelo = await prisma.vuelo.findUnique({ where: { id: parseInt(vueloId) } });
    if (!vuelo) return res.status(404).json({ error: 'Vuelo no encontrado' });
    if (vuelo.asientosDisponibles < 1) return res.status(400).json({ error: 'Sin asientos disponibles' });
    if (new Date() >= vuelo.fechaSalida) return res.status(400).json({ error: 'El vuelo ya salió' });

    // Transacción: descontar asiento + crear reserva atómicamente
    const [, reserva] = await prisma.$transaction([
      prisma.vuelo.update({
        where: { id: vuelo.id },
        data: { asientosDisponibles: { decrement: 1 } },
      }),
      prisma.reserva.create({
        data: {
          usuarioId: req.user.id,
          vueloId: vuelo.id,
          total: vuelo.precio,
          estado: 'PENDIENTE',
          // Expiración a 10 minutos (sin cron job, se verifica al consultar)
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
        include: { vuelo: { select: { origen: true, destino: true, fechaSalida: true } } },
      }),
    ]);

    res.status(201).json({ reserva });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/reservas/:id/pagar → pago simulado
// FIX: Anti-replay — requiere header X-Idempotency-Key (nonce UUID generado por el cliente).
// Si el mismo nonce se reutiliza, el request se rechaza con 409.
// Esto evita que un request de pago capturado pueda reenviarse durante las 8h de validez del token.
router.post('/:id/pagar', auth, authorizeRoles('CLIENT'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    // Validar nonce anti-replay
    const nonce = req.headers['x-idempotency-key'];
    if (!nonce || nonce.length < 10) {
      return res.status(400).json({ error: 'Se requiere el header X-Idempotency-Key' });
    }
    // Limpiar nonces expirados y verificar que este no se haya usado
    await prisma.usedNonce.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    const nonceExistente = await prisma.usedNonce.findUnique({ where: { nonce } });
    if (nonceExistente) {
      console.log(JSON.stringify({ timestamp: new Date().toISOString(), event: 'REPLAY_ATTACK', userId: req.user.id, nonce, action: 'pagar' }));
      return res.status(409).json({ error: 'Request duplicado. Genera un nuevo identificador.' });
    }

    // OWASP: Broken Access Control / IDOR → verificar que la reserva pertenece al usuario
    const reserva = await checkExpiracion(id);
    if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' });
    if (reserva.usuarioId !== req.user.id) return res.status(403).json({ error: 'Acceso denegado' });
    if (reserva.estado === 'EXPIRADA') return res.status(400).json({ error: 'La reserva ha expirado' });
    if (reserva.estado === 'CANCELADA') return res.status(400).json({ error: 'La reserva fue cancelada' });
    if (reserva.estado === 'PAGADA') return res.status(400).json({ error: 'La reserva ya fue pagada' });

    // Registrar nonce + pago en transacción atómica
    const [, reservaActualizada, pago] = await prisma.$transaction([
      prisma.usedNonce.create({
        data: { nonce, action: 'pagar', userId: req.user.id, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      }),
      prisma.reserva.update({ where: { id }, data: { estado: 'PAGADA' } }),
      prisma.pago.create({
        data: { reservaId: id, folio: uuidv4(), monto: reserva.total, estado: 'COMPLETADO' },
      }),
    ]);

    console.log(JSON.stringify({ timestamp: new Date().toISOString(), event: 'PAYMENT', userId: req.user.id, reservaId: id, folio: pago.folio }));
    res.json({ mensaje: 'Pago exitoso', folio: pago.folio });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/reservas/:id → cancelar reserva propia
// FIX: Anti-replay — mismo mecanismo de nonce que en pagar
router.delete('/:id', auth, authorizeRoles('CLIENT'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    // Validar nonce anti-replay
    const nonce = req.headers['x-idempotency-key'];
    if (!nonce || nonce.length < 10) {
      return res.status(400).json({ error: 'Se requiere el header X-Idempotency-Key' });
    }
    await prisma.usedNonce.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    const nonceExistente = await prisma.usedNonce.findUnique({ where: { nonce } });
    if (nonceExistente) {
      console.log(JSON.stringify({ timestamp: new Date().toISOString(), event: 'REPLAY_ATTACK', userId: req.user.id, nonce, action: 'cancelar' }));
      return res.status(409).json({ error: 'Request duplicado. Genera un nuevo identificador.' });
    }

    // OWASP: Broken Access Control / IDOR → verificar propietario
    const reserva = await prisma.reserva.findUnique({ where: { id } });
    if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' });
    if (reserva.usuarioId !== req.user.id) return res.status(403).json({ error: 'Acceso denegado' });
    if (reserva.estado === 'PAGADA') return res.status(400).json({ error: 'No se puede cancelar una reserva pagada' });
    if (reserva.estado === 'CANCELADA') return res.status(400).json({ error: 'Ya está cancelada' });

    await prisma.$transaction([
      prisma.usedNonce.create({
        data: { nonce, action: 'cancelar', userId: req.user.id, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      }),
      prisma.reserva.update({ where: { id }, data: { estado: 'CANCELADA' } }),
      // Devolver asiento si estaba pendiente
      ...(reserva.estado === 'PENDIENTE'
        ? [prisma.vuelo.update({ where: { id: reserva.vueloId }, data: { asientosDisponibles: { increment: 1 } } })]
        : []),
    ]);

    console.log(JSON.stringify({ timestamp: new Date().toISOString(), event: 'CANCEL_RESERVATION', userId: req.user.id, reservaId: id }));
    res.json({ mensaje: 'Reserva cancelada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/reservas/admin/todas → ADMIN ve todas las reservas
router.get('/admin/todas', auth, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const reservas = await prisma.reserva.findMany({
      include: {
        usuario: { select: { nombre: true, email: true } },
        vuelo: { select: { origen: true, destino: true, fechaSalida: true } },
        pago: { select: { folio: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ reservas });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
