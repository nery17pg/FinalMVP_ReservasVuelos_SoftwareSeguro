const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { PrismaClient } = require('@prisma/client');
const { authenticator } = require('otplib');
const qrcode = require('qrcode');
const { auth } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// ──────────────────────────────────────────────────────────────────────────────
// VALIDACIONES
// ──────────────────────────────────────────────────────────────────────────────
const registerValidations = [
  body('nombre').trim().notEmpty().isLength({ max: 100 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[A-Z])(?=.*[0-9])/),
];

// ──────────────────────────────────────────────────────────────────────────────
// REGISTRO
// ──────────────────────────────────────────────────────────────────────────────
router.post('/register', registerValidations, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Datos inválidos', detalles: errors.array() });

  const { nombre, email, password } = req.body;
  try {
    const existe = await prisma.usuario.findUnique({ where: { email } });
    if (existe) {
      console.log(`[SECURITY] Intento de registro con email existente: ${email}`);
      return res.status(200).json({ mensaje: 'Si el email es nuevo, tu cuenta estará lista en breve.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const usuario = await prisma.usuario.create({
      data: { nombre, email, password: hash, role: 'CLIENT' },
    });

    res.status(201).json({ mensaje: 'Registro exitoso', id: usuario.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// LOGIN — Flujo de 2 pasos cuando MFA está activo
//
// Paso 1 (sin totp): verifica email+password+captcha
//   → Si MFA activo: devuelve { mfaRequired: true, mfaTempToken }
//   → Si MFA inactivo: emite JWT completo (sesión iniciada)
//
// Paso 2 (con totp): verifica código TOTP usando mfaTempToken
//   → Emite JWT completo (sesión iniciada)
// ──────────────────────────────────────────────────────────────────────────────
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Datos inválidos' });

  const { email, password, captchaToken } = req.body;
  try {
    // Verificar CAPTCHA
    const captchaRes = await fetch('https://hcaptcha.com/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${process.env.HCAPTCHA_SECRET}&response=${captchaToken}`,
    });
    const captchaData = await captchaRes.json();
    if (!captchaData.success) {
      return res.status(400).json({ error: 'CAPTCHA inválido. Por favor verifica que no eres un robot.' });
    }

    const usuario = await prisma.usuario.findUnique({ where: { email } });
    if (!usuario) {
      console.log(JSON.stringify({ timestamp: new Date().toISOString(), event: 'LOGIN_FAIL', reason: 'email_not_found', email }));
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const valid = await bcrypt.compare(password, usuario.password);
    if (!valid) {
      console.log(JSON.stringify({ timestamp: new Date().toISOString(), event: 'LOGIN_FAIL', reason: 'wrong_password', userId: usuario.id }));
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    // Si MFA está activo, emitir token temporal y pedir el código TOTP
    if (usuario.mfaEnabled) {
      const mfaTempToken = jwt.sign(
        { id: usuario.id, mfaPending: true },
        process.env.JWT_SECRET,
        { expiresIn: '5m' } // 5 minutos para ingresar el código
      );
      console.log(JSON.stringify({ timestamp: new Date().toISOString(), event: 'MFA_REQUIRED', userId: usuario.id }));
      return res.json({ mfaRequired: true, mfaTempToken });
    }

    // Sin MFA: emitir sesión completa directamente
    _emitirSesion(res, usuario);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// VERIFICAR CÓDIGO MFA (Paso 2 del login)
// ──────────────────────────────────────────────────────────────────────────────
router.post('/login/mfa', async (req, res) => {
  const { mfaTempToken, totp } = req.body;
  if (!mfaTempToken || !totp) {
    return res.status(400).json({ error: 'Token y código MFA requeridos' });
  }

  try {
    // Verificar el token temporal
    let payload;
    try {
      payload = jwt.verify(mfaTempToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Token MFA expirado o inválido. Inicia sesión de nuevo.' });
    }

    if (!payload.mfaPending) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    const usuario = await prisma.usuario.findUnique({ where: { id: payload.id } });
    if (!usuario || !usuario.mfaEnabled || !usuario.mfaSecret) {
      return res.status(401).json({ error: 'MFA no configurado para este usuario' });
    }

    // Verificar el código TOTP
    const totpValido = authenticator.verify({ token: totp, secret: usuario.mfaSecret });
    if (!totpValido) {
      console.log(JSON.stringify({ timestamp: new Date().toISOString(), event: 'MFA_FAIL', userId: usuario.id }));
      return res.status(401).json({ error: 'Código MFA incorrecto' });
    }

    console.log(JSON.stringify({ timestamp: new Date().toISOString(), event: 'LOGIN_SUCCESS_MFA', userId: usuario.id, role: usuario.role }));
    _emitirSesion(res, usuario);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// CONFIGURAR MFA — Generar secret + QR (requiere sesión activa)
// ──────────────────────────────────────────────────────────────────────────────
router.post('/mfa/setup', auth, async (req, res) => {
  try {
    const usuario = await prisma.usuario.findUnique({ where: { id: req.user.id } });
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Si ya tiene MFA activo, no permitir re-setup sin desactivarlo antes
    if (usuario.mfaEnabled) {
      return res.status(400).json({ error: 'MFA ya está activo. Desactívalo primero para reconfigurarlo.' });
    }

    // Generar nuevo secret TOTP
    const secret = authenticator.generateSecret();

    // Guardar el secret (aún no activado — se activa al verificar)
    await prisma.usuario.update({
      where: { id: req.user.id },
      data: { mfaSecret: secret, mfaEnabled: false },
    });

    // Generar URI para QR compatible con Google Authenticator / Authy
    const otpAuthUrl = authenticator.keyuri(usuario.email, 'VuelosApp', secret);
    const qrDataUrl = await qrcode.toDataURL(otpAuthUrl);

    res.json({
      secret,      // mostrar como respaldo manual
      qrDataUrl,   // imagen base64 para escanear
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// ACTIVAR MFA — Verificar primer código TOTP para confirmar que el setup fue correcto
// ──────────────────────────────────────────────────────────────────────────────
router.post('/mfa/verify', auth, async (req, res) => {
  const { totp } = req.body;
  if (!totp) return res.status(400).json({ error: 'Código TOTP requerido' });

  try {
    const usuario = await prisma.usuario.findUnique({ where: { id: req.user.id } });
    if (!usuario || !usuario.mfaSecret) {
      return res.status(400).json({ error: 'Primero configura MFA con /mfa/setup' });
    }
    if (usuario.mfaEnabled) {
      return res.status(400).json({ error: 'MFA ya está activo' });
    }

    const valido = authenticator.verify({ token: totp, secret: usuario.mfaSecret });
    if (!valido) {
      return res.status(401).json({ error: 'Código incorrecto. Verifica que tu autenticador esté sincronizado.' });
    }

    // Activar MFA
    await prisma.usuario.update({
      where: { id: req.user.id },
      data: { mfaEnabled: true },
    });

    console.log(JSON.stringify({ timestamp: new Date().toISOString(), event: 'MFA_ENABLED', userId: req.user.id }));
    res.json({ mensaje: 'MFA activado correctamente. Se pedirá el código en cada inicio de sesión.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// DESACTIVAR MFA (requiere sesión activa + código TOTP de confirmación)
// ──────────────────────────────────────────────────────────────────────────────
router.post('/mfa/disable', auth, async (req, res) => {
  const { totp } = req.body;
  if (!totp) return res.status(400).json({ error: 'Código TOTP requerido para desactivar MFA' });

  try {
    const usuario = await prisma.usuario.findUnique({ where: { id: req.user.id } });
    if (!usuario || !usuario.mfaEnabled || !usuario.mfaSecret) {
      return res.status(400).json({ error: 'MFA no está activo' });
    }

    const valido = authenticator.verify({ token: totp, secret: usuario.mfaSecret });
    if (!valido) {
      return res.status(401).json({ error: 'Código incorrecto' });
    }

    await prisma.usuario.update({
      where: { id: req.user.id },
      data: { mfaEnabled: false, mfaSecret: null },
    });

    console.log(JSON.stringify({ timestamp: new Date().toISOString(), event: 'MFA_DISABLED', userId: req.user.id }));
    res.json({ mensaje: 'MFA desactivado correctamente.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// ESTADO MFA — saber si el usuario tiene MFA activo
// ──────────────────────────────────────────────────────────────────────────────
router.get('/mfa/status', auth, async (req, res) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.user.id },
      select: { mfaEnabled: true },
    });
    res.json({ mfaEnabled: usuario?.mfaEnabled ?? false });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// LOGOUT
// ──────────────────────────────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.clearCookie('csrf-token');
  res.json({ mensaje: 'Sesión cerrada' });
});

// ──────────────────────────────────────────────────────────────────────────────
// ME — verificar sesión activa
// ──────────────────────────────────────────────────────────────────────────────
router.get('/me', auth, async (req, res) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.user.id },
      select: { id: true, nombre: true, email: true, role: true, mfaEnabled: true },
    });
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ usuario });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// PERFIL
// ──────────────────────────────────────────────────────────────────────────────
router.put('/perfil', auth, [
  body('nombre').trim().notEmpty().isLength({ max: 100 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Datos inválidos' });

  try {
    const usuario = await prisma.usuario.update({
      where: { id: req.user.id },
      data: { nombre: req.body.nombre },
      select: { id: true, nombre: true, email: true, role: true },
    });
    res.json({ usuario });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// Helper: emitir cookies de sesión completa
// ──────────────────────────────────────────────────────────────────────────────
function _emitirSesion(res, usuario) {
  const token = jwt.sign(
    { id: usuario.id, email: usuario.email, role: usuario.role },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.cookie('token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 8 * 60 * 60 * 1000,
  });

  const csrfToken = uuidv4();
  res.cookie('csrf-token', csrfToken, {
    httpOnly: false,
    secure: true,
    sameSite: 'strict',
    maxAge: 8 * 60 * 60 * 1000,
  });

  console.log(JSON.stringify({ timestamp: new Date().toISOString(), event: 'LOGIN_SUCCESS', userId: usuario.id, role: usuario.role }));

  res.json({
    usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, role: usuario.role },
  });
}

module.exports = router;