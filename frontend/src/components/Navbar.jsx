import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { usuario, logout } = useAuth();
  const loc = useLocation();
  const isActive = (path) => loc.pathname === path ? 'nav-link active' : 'nav-link';

  return (
    <nav className="navbar">
      <div className="nav-brand">
        <Link to="/vuelos">✈ VuelosApp</Link>
      </div>
      <div className="nav-links">
        {usuario ? (
          <>
            <Link to="/vuelos" className={isActive('/vuelos')}>Vuelos</Link>
            <Link to="/reservas" className={isActive('/reservas')}>Mis Reservas</Link>
            {(usuario.role === 'ADMIN' || usuario.role === 'STAFF') && (
              <Link to="/admin" className={isActive('/admin')}>Panel</Link>
            )}
            <Link to="/mfa" className={isActive('/mfa')} title="Configurar autenticación de dos factores">
              {usuario.mfaEnabled ? '🔐 MFA' : '🔓 MFA'}
            </Link>
            <span className="nav-user">👤 {usuario.nombre} ({usuario.role})</span>
            <button onClick={logout} className="btn-logout">Salir</button>
          </>
        ) : (
          <>
            <Link to="/login" className={isActive('/login')}>Iniciar sesión</Link>
            <Link to="/register" className={isActive('/register')}>Registrarse</Link>
          </>
        )}
      </div>
    </nav>
  );
}