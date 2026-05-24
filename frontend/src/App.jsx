import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Vuelos from './pages/Vuelos';
import Reservas from './pages/Reservas';
import Admin from './pages/Admin';
import MfaConfig from './pages/MfaConfig';
import './styles.css';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Navigate to="/vuelos" />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/vuelos" element={<Vuelos />} />
            <Route path="/reservas" element={
              <ProtectedRoute roles={['CLIENT']}>
                <Reservas />
              </ProtectedRoute>
            } />
            <Route path="/admin" element={
              <ProtectedRoute roles={['ADMIN', 'STAFF']}>
                <Admin />
              </ProtectedRoute>
            } />
            <Route path="/mfa" element={
              <ProtectedRoute roles={['CLIENT', 'ADMIN', 'STAFF']}>
                <MfaConfig />
              </ProtectedRoute>
            } />
          </Routes>
        </main>
      </BrowserRouter>
    </AuthProvider>
  );
}