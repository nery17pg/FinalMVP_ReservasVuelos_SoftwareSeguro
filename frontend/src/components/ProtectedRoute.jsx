import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, roles }) {
  const { usuario, cargando } = useAuth();

  if (cargando) return <div className="loading">Cargando...</div>;
  if (!usuario) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(usuario.role)) return <Navigate to="/vuelos" replace />;

  return children;
}
