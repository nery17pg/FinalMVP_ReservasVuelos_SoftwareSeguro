import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [captchaToken, setCaptchaToken] = useState(null);

  // Estado para el flujo MFA
  const [mfaPending, setMfaPending] = useState(false);
  const [mfaTempToken, setMfaTempToken] = useState('');
  const [totpCode, setTotpCode] = useState('');

  const { login, loginMfa } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e) => setCaptchaToken(e.detail);
    window.addEventListener('captcha-success', handler);

    const renderWidget = () => {
      if (window.hcaptcha) {
        const el = document.querySelector('.h-captcha');
        if (el && !el.querySelector('iframe')) {
          window.hcaptcha.render(el, {
            sitekey: '4a903d16-8e4e-4760-a4f6-43f6402e1d0c',
            callback: (token) => setCaptchaToken(token),
          });
        }
      }
    };

    // Intentar inmediatamente y también después de un pequeño delay
    renderWidget();
    const timer = setTimeout(renderWidget, 500);

    return () => {
      window.removeEventListener('captcha-success', handler);
      clearTimeout(timer);
    };
  }, []);

  // ── Paso 1: email + password + captcha ────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!captchaToken) {
      setError('Por favor completa el CAPTCHA');
      return;
    }

    setCargando(true);
    try {
      const resultado = await login(form.email, form.password, captchaToken);

      if (resultado?.mfaRequired) {
        setMfaTempToken(resultado.mfaTempToken);
        setMfaPending(true);
      } else {
        navigate(resultado.role === 'CLIENT' ? '/vuelos' : '/admin');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión');
      window.hcaptcha?.reset();
      setCaptchaToken(null);
    } finally {
      setCargando(false);
    }
  };

  // ── Paso 2: código TOTP ───────────────────────────────────────────────────
  const handleMfaSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!totpCode || totpCode.length !== 6) {
      setError('El código debe tener 6 dígitos');
      return;
    }

    setCargando(true);
    try {
      const usuario = await loginMfa(mfaTempToken, totpCode);
      navigate(usuario.role === 'CLIENT' ? '/vuelos' : '/admin');
    } catch (err) {
      setError(err.response?.data?.error || 'Código incorrecto');
      setTotpCode('');
    } finally {
      setCargando(false);
    }
  };

  // ── Pantalla MFA ──────────────────────────────────────────────────────────
  if (mfaPending) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h2>Verificación MFA</h2>
          <p style={{ color: 'var(--text-muted, #666)', marginBottom: '1rem', fontSize: '0.95rem' }}>
            Abre tu aplicación autenticadora (Google Authenticator, Authy, etc.)
            e ingresa el código de 6 dígitos.
          </p>
          <form onSubmit={handleMfaSubmit}>
            <div className="form-group">
              <label>Código de verificación</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={totpCode}
                onChange={e => setTotpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                required
                autoFocus
                style={{ letterSpacing: '0.4em', fontSize: '1.3rem', textAlign: 'center' }}
              />
            </div>
            {error && <div className="error-msg">{error}</div>}
            <button type="submit" className="btn-primary" disabled={cargando}>
              {cargando ? 'Verificando...' : 'Verificar'}
            </button>
          </form>
          <p className="auth-footer">
            <button
              style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => { setMfaPending(false); setMfaTempToken(''); setError(''); }}
            >
              ← Volver al inicio de sesión
            </button>
          </p>
        </div>
      </div>
    );
  }

  // ── Pantalla principal de login ───────────────────────────────────────────
  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>✈ Iniciar sesión</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              required
              placeholder="tu@email.com"
            />
          </div>
          <div className="form-group">
            <label>Contraseña</label>
            <input
              type="password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required
              placeholder="••••••••"
            />
          </div>

          {/* Widget de hCaptcha */}
          <div
            className="h-captcha"
            data-sitekey="4a903d16-8e4e-4760-a4f6-43f6402e1d0c"
            data-callback="onCaptchaSuccess"
          ></div>

          {error && <div className="error-msg">{error}</div>}
          <button type="submit" className="btn-primary" disabled={cargando}>
            {cargando ? 'Entrando...' : 'Iniciar sesión'}
          </button>
        </form>
        <p className="auth-footer">
          ¿No tienes cuenta? <Link to="/register">Regístrate</Link>
        </p>
        <div className="test-users">
          <p><strong>Usuarios de prueba:</strong></p>
          <p>admin@vuelos.com / Admin123!</p>
          <p>staff@vuelos.com / Staff123!</p>
          <p>cliente@vuelos.com / Client123!</p>
        </div>
      </div>
    </div>
  );
}