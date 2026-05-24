require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const authRoutes = require('./routes/auth');
const vuelosRoutes = require('./routes/vuelos');
const reservasRoutes = require('./routes/reservas');
const adminRoutes = require('./routes/admin');

const app = express();

// OWASP: Security Misconfiguration → Helmet añade headers de seguridad HTTP
app.use(helmet());

// CORS configurado sólo para el frontend (no wildcard)
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true, // necesario para enviar cookies
}));

app.use(express.json());
app.use(cookieParser());

// ── LOGGING ESTRUCTURADO (R — Repudiation) ──────────────────────────────────
// Registra cada request con timestamp, IP, método, ruta y status.
// Los logs van a consola (stdout) y a archivo access.log para persistencia.
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
const accessLogStream = fs.createWriteStream(path.join(logsDir, 'access.log'), { flags: 'a' });

function structuredLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const entry = JSON.stringify({
      timestamp: new Date().toISOString(),
      ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ms: Date.now() - start,
      user: req.user?.id ?? null,
    });
    console.log('[ACCESS]', entry);
    accessLogStream.write(entry + '\n');
  });
  next();
}
app.use(structuredLogger);
// ────────────────────────────────────────────────────────────────────────────

// OWASP: DoS → rate limiting global (100 req/15min por IP)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Demasiadas solicitudes, intenta más tarde' },
});
app.use(limiter);

// FIX: Rate limit estricto para login → máximo 5 intentos cada 15 min por IP
// (antes era 100, lo que permitía fuerza bruta prácticamente sin restricción)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Demasiados intentos de autenticación. Espera 15 minutos.' },
  skipSuccessfulRequests: true, // los logins exitosos no cuentan contra el límite
});
app.use('/api/auth/login', authLimiter);

// Rate limit para registro: 3 cuentas por IP cada hora (mitigar registros masivos)
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: 'Demasiados registros desde esta IP. Intenta en una hora.' },
});
app.use('/api/auth/register', registerLimiter);

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/vuelos', vuelosRoutes);
app.use('/api/reservas', reservasRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Manejo de errores global: no exponer stack traces (OWASP: Information Disclosure)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

//New Addition: Servidor HTTPS con certificados autofirmados para desarrollo local
const https = require('https');
//const fs = require('fs');
//const path = require('path');

const PORT = process.env.PORT || 4000;

const sslOptions = {
  key: fs.readFileSync(path.join(__dirname, '../localhost-key.pem')),
  cert: fs.readFileSync(path.join(__dirname, '../localhost.pem')),
};

https.createServer(sslOptions, app).listen(PORT, () => {
  console.log(`🚀 Backend corriendo en https://localhost:${PORT}`);
});

/*const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Backend corriendo en http://localhost:${PORT}`);
});*/
