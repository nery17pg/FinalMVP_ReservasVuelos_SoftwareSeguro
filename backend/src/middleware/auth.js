const jwt = require('jsonwebtoken');

// STRIDE: Spoofing → verificamos firma JWT en cada request
function auth(req, res, next) {
  try {
    // Leemos token desde cookie HttpOnly (OWASP: evitar exposición en localStorage)
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ error: 'No autenticado' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email, role }
    next();
  } catch (err) {
    // Manejo seguro de errores: no revelar detalles internos
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

// STRIDE: Elevation of Privilege → RBAC por roles
function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    next();
  };
}

// CSRF simple: validar que header x-csrf-token coincida con cookie csrf-token
function csrfProtect(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const headerToken = req.headers['x-csrf-token'];
  const cookieToken = req.cookies?.['csrf-token'];
  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    return res.status(403).json({ error: 'CSRF token inválido' });
  }
  next();
}

module.exports = { auth, authorizeRoles, csrfProtect };
