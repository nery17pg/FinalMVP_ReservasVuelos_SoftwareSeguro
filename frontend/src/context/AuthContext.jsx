import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api.get('/auth/me')
      .then(res => setUsuario(res.data.usuario))
      .catch(() => setUsuario(null))
      .finally(() => setCargando(false));
  }, []);

  /**
   * Login paso 1: email + password + captcha
   * Devuelve:
   *   { mfaRequired: true, mfaTempToken } si el usuario tiene MFA activo
   *   usuario                              si no tiene MFA (sesión completa)
   */
  const login = async (email, password, captchaToken) => {
    const res = await api.post('/auth/login', { email, password, captchaToken });
    if (res.data.mfaRequired) {
      // No hay sesión todavía — devolver el token temporal al componente
      return { mfaRequired: true, mfaTempToken: res.data.mfaTempToken };
    }
    setUsuario(res.data.usuario);
    return res.data.usuario;
  };

  /**
   * Login paso 2: verificar código TOTP con el token temporal
   */
  const loginMfa = async (mfaTempToken, totp) => {
    const res = await api.post('/auth/login/mfa', { mfaTempToken, totp });
    setUsuario(res.data.usuario);
    return res.data.usuario;
  };

  const logout = async () => {
    await api.post('/auth/logout');
    setUsuario(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ usuario, setUsuario, login, loginMfa, logout, cargando }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);