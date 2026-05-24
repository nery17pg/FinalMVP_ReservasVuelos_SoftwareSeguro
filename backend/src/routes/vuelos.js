const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { auth, authorizeRoles } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/vuelos → buscar vuelos (público o autenticado)
router.get('/', [
  query('origen').optional().trim(),
  query('destino').optional().trim(),
], async (req, res) => {
  try {
    const { origen, destino } = req.query;
    const where = {};
    // OWASP: Injection → Prisma ORM previene SQL Injection por defecto
    if (origen) where.origen = { contains: origen, mode: 'insensitive' };
    if (destino) where.destino = { contains: destino, mode: 'insensitive' };
    // Solo mostrar vuelos con asientos disponibles y fecha futura
    where.asientosDisponibles = { gt: 0 };
    where.fechaSalida = { gte: new Date() };

    const vuelos = await prisma.vuelo.findMany({ where, orderBy: { fechaSalida: 'asc' } });
    res.json({ vuelos });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/vuelos/todos → admin/staff ven todos los vuelos sin filtro
router.get('/todos', auth, authorizeRoles('ADMIN', 'STAFF'), async (req, res) => {
  try {
    const vuelos = await prisma.vuelo.findMany({ orderBy: { fechaSalida: 'asc' } });
    res.json({ vuelos });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

const vueloValidations = [
  body('origen').trim().notEmpty().isLength({ max: 100 }),
  body('destino').trim().notEmpty().isLength({ max: 100 }),
  body('fechaSalida').isISO8601(),
  body('precio').isFloat({ min: 0 }),
  body('asientosDisponibles').isInt({ min: 0 }),
];

// POST /api/vuelos → crear vuelo (STAFF/ADMIN)
router.post('/', auth, authorizeRoles('ADMIN', 'STAFF'), vueloValidations, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Datos inválidos', detalles: errors.array() });

  try {
    const { origen, destino, fechaSalida, precio, asientosDisponibles } = req.body;
    const vuelo = await prisma.vuelo.create({
      data: { origen, destino, fechaSalida: new Date(fechaSalida), precio: parseFloat(precio), asientosDisponibles: parseInt(asientosDisponibles) },
    });
    res.status(201).json({ vuelo });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/vuelos/:id → editar vuelo (STAFF/ADMIN)
router.put('/:id', auth, authorizeRoles('ADMIN', 'STAFF'), vueloValidations, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Datos inválidos', detalles: errors.array() });

  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const { origen, destino, fechaSalida, precio, asientosDisponibles } = req.body;
    const vuelo = await prisma.vuelo.update({
      where: { id },
      data: { origen, destino, fechaSalida: new Date(fechaSalida), precio: parseFloat(precio), asientosDisponibles: parseInt(asientosDisponibles) },
    });
    res.json({ vuelo });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/vuelos/:id → eliminar vuelo (ADMIN only)
router.delete('/:id', auth, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
    await prisma.vuelo.delete({ where: { id } });
    res.json({ mensaje: 'Vuelo eliminado' });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
