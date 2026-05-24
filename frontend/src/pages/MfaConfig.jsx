import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function MfaConfig() {
  const { usuario } = useAuth();
  const navigate = useNavigate();

  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [totp, setTotp] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [paso, setPaso] = useState('inicio'); // 'inicio' | 'qr' | 'desactivar'

  useEffect(() => {
    api.get('/auth/mfa/status').then(res => setMfaEnabled(res.data.mfaEnabled));
  }, []);

  // ── Iniciar configuración: obtener QR ────────────────────────────────────
  const iniciarSetup = async () => {
    setError('');
    setCargando(true);
    try {
      const res = await api.post('/auth/mfa/setup');
      setQrDataUrl(res.data.qrDataUrl);
      setSecret(res.data.secret);
      setPaso('qr');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al generar QR');
    } finally {
      setCargando(false);
    }
  };

  // ── Activar MFA: verificar primer código ─────────────────────────────────
  const activarMfa = async (e) => {
    e.preventDefault();
    setError('');
    if (!totp || totp.length !== 6) { setError('El código debe tener 6 dígitos'); return; }

    setCargando(true);
    try {
      const res = await api.post('/auth/mfa/verify', { totp });
      setMensaje(res.data.mensaje);
      setMfaEnabled(true);
      setPaso('inicio');
      setTotp('');
    } catch (err) {
      setError(err.response?.data?.error || 'Código incorrecto');
    } finally {
      setCargando(false);
    }
  };

  // ── Desactivar MFA ────────────────────────────────────────────────────────
  const desactivarMfa = async (e) => {
    e.preventDefault();
    setError('');
    if (!totp || totp.length !== 6) { setError('El código debe tener 6 dígitos'); return; }

    setCargando(true);
    try {
      const res = await api.post('/auth/mfa/disable', { totp });
      setMensaje(res.data.mensaje);
      setMfaEnabled(false);
      setPaso('inicio');
      setTotp('');
    } catch (err) {
      setError(err.response?.data?.error || 'Código incorrecto');
    } finally {
      setCargando(false);
    }
  };

  const card = { maxWidth: 480, margin: '2rem auto', background: '#fff', borderRadius: 12, padding: '2rem', boxShadow: '0 2px 16px rgba(0,0,0,0.1)' };
  const badge = (activo) => ({
    display: 'inline-block', padding: '4px 12px', borderRadius: 20, fontSize: '0.85rem', fontWeight: 600,
    background: activo ? '#d1fae5' : '#fee2e2', color: activo ? '#065f46' : '#991b1b',
  });

  return (
    <div style={{ padding: '1rem' }}>
      <div style={card}>
        <h2 style={{ marginBottom: '0.5rem' }}>🔐 Autenticación de dos factores (MFA)</h2>

        <p style={{ marginBottom: '1rem' }}>
          Estado: <span style={badge(mfaEnabled)}>{mfaEnabled ? '✅ Activo' : '❌ Inactivo'}</span>
        </p>

        {mensaje && <div style={{ background: '#d1fae5', color: '#065f46', padding: '0.75rem', borderRadius: 8, marginBottom: '1rem' }}>{mensaje}</div>}
        {error && <div className="error-msg">{error}</div>}

        {/* ── Estado inicial ─────────────────────────────────────────────── */}
        {paso === 'inicio' && !mfaEnabled && (
          <div>
            <p style={{ color: '#555', marginBottom: '1rem', lineHeight: 1.6 }}>
              Activa MFA para proteger tu cuenta con una capa extra de seguridad.
              Necesitarás una app como <strong>Google Authenticator</strong> o <strong>Authy</strong>.
            </p>
            <button className="btn-primary" onClick={iniciarSetup} disabled={cargando}>
              {cargando ? 'Generando...' : 'Configurar MFA'}
            </button>
          </div>
        )}

        {paso === 'inicio' && mfaEnabled && (
          <div>
            <p style={{ color: '#555', marginBottom: '1rem', lineHeight: 1.6 }}>
              MFA está activo. Se pedirá un código de 6 dígitos en cada inicio de sesión.
            </p>
            <button
              style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, padding: '0.65rem 1.25rem', cursor: 'pointer', fontWeight: 600 }}
              onClick={() => { setPaso('desactivar'); setTotp(''); setError(''); }}
            >
              Desactivar MFA
            </button>
          </div>
        )}

        {/* ── Escanear QR ────────────────────────────────────────────────── */}
        {paso === 'qr' && (
          <div>
            <p style={{ color: '#555', marginBottom: '1rem', lineHeight: 1.6 }}>
              <strong>Paso 1:</strong> Escanea este código QR con tu app autenticadora.
            </p>
            {qrDataUrl && (
              <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <img src={qrDataUrl} alt="QR MFA" style={{ width: 200, height: 200, borderRadius: 8, border: '1px solid #ddd' }} />
              </div>
            )}
            <details style={{ marginBottom: '1rem' }}>
              <summary style={{ cursor: 'pointer', color: '#666', fontSize: '0.9rem' }}>¿No puedes escanear? Ingresa el código manual</summary>
              <code style={{ display: 'block', background: '#f3f4f6', padding: '0.5rem', borderRadius: 6, marginTop: '0.5rem', wordBreak: 'break-all', fontSize: '0.85rem' }}>
                {secret}
              </code>
            </details>
            <p style={{ color: '#555', marginBottom: '0.5rem' }}>
              <strong>Paso 2:</strong> Ingresa el código de 6 dígitos que aparece en tu app para confirmar.
            </p>
            <form onSubmit={activarMfa}>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={totp}
                onChange={e => setTotp(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                autoFocus
                style={{ letterSpacing: '0.4em', fontSize: '1.3rem', textAlign: 'center', width: '100%', padding: '0.65rem', borderRadius: 8, border: '1px solid #d1d5db', marginBottom: '0.75rem' }}
              />
              <button type="submit" className="btn-primary" disabled={cargando}>
                {cargando ? 'Verificando...' : 'Activar MFA'}
              </button>
            </form>
            <button
              style={{ marginTop: '0.75rem', background: 'none', border: 'none', color: '#666', cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => { setPaso('inicio'); setQrDataUrl(''); setSecret(''); setError(''); }}
            >
              Cancelar
            </button>
          </div>
        )}

        {/* ── Desactivar MFA ──────────────────────────────────────────────── */}
        {paso === 'desactivar' && (
          <div>
            <p style={{ color: '#991b1b', marginBottom: '1rem', lineHeight: 1.6 }}>
              ⚠️ Ingresa tu código TOTP actual para confirmar que deseas desactivar MFA.
            </p>
            <form onSubmit={desactivarMfa}>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={totp}
                onChange={e => setTotp(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                autoFocus
                style={{ letterSpacing: '0.4em', fontSize: '1.3rem', textAlign: 'center', width: '100%', padding: '0.65rem', borderRadius: 8, border: '1px solid #fca5a5', marginBottom: '0.75rem' }}
              />
              <button
                type="submit"
                disabled={cargando}
                style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, padding: '0.65rem 1.25rem', cursor: 'pointer', fontWeight: 600, width: '100%' }}
              >
                {cargando ? 'Desactivando...' : 'Confirmar desactivación'}
              </button>
            </form>
            <button
              style={{ marginTop: '0.75rem', background: 'none', border: 'none', color: '#666', cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => { setPaso('inicio'); setTotp(''); setError(''); }}
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}