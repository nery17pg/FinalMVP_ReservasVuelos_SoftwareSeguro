const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { auth, authorizeRoles } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/admin/usuarios → listar usuarios (ADMIN)
router.get('/usuarios', auth, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    // FIX: Logging de auditoría — registrar quién consultó la lista de usuarios y cuándo
    console.log(JSON.stringify({ timestamp: new Date().toISOString(), event: 'ADMIN_LIST_USERS', adminId: req.user.id }));
    // OWASP: Information Disclosure → nunca devolver password
    const usuarios = await prisma.usuario.findMany({
      select: { id: true, nombre: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ usuarios });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/admin/usuarios/:id/role → cambiar rol (ADMIN)
router.put('/usuarios/:id/role', auth, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const { role } = req.body;
    if (!['CLIENT', 'STAFF', 'ADMIN'].includes(role)) {
      return res.status(400).json({ error: 'Rol inválido' });
    }

    // Evitar que admin se quite su propio rol
    if (id === req.user.id) return res.status(400).json({ error: 'No puedes cambiar tu propio rol' });

    const usuario = await prisma.usuario.update({
      where: { id },
      data: { role },
      select: { id: true, nombre: true, email: true, role: true },
    });
    // FIX: Logging de auditoría para cambios de rol
    console.log(JSON.stringify({ timestamp: new Date().toISOString(), event: 'ADMIN_CHANGE_ROLE', adminId: req.user.id, targetUserId: id, newRole: role }));
    res.json({ usuario });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/admin/usuarios/:id → eliminar usuario (ADMIN)
router.delete('/usuarios/:id', auth, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
    if (id === req.user.id) return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });

    await prisma.usuario.delete({ where: { id } });
    // FIX: Logging de auditoría para eliminación de usuarios
    console.log(JSON.stringify({ timestamp: new Date().toISOString(), event: 'ADMIN_DELETE_USER', adminId: req.user.id, deletedUserId: id }));
    res.json({ mensaje: 'Usuario eliminado' });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
