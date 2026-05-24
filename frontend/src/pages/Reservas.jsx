import { useState, useEffect } from 'react';
import api from '../services/api';

const ESTADOS = {
  PENDIENTE: { label: 'Pendiente', color: '#f59e0b' },
  PAGADA: { label: 'Pagada', color: '#10b981' },
  CANCELADA: { label: 'Cancelada', color: '#ef4444' },
  EXPIRADA: { label: 'Expirada', color: '#6b7280' },
};

export default function Reservas() {
  const [reservas, setReservas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState('');

  const cargar = async () => {
    try {
      const res = await api.get('/reservas');
      setReservas(res.data.reservas);
    } catch (err) {
      setMensaje('Error al cargar reservas');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const mostrarMensaje = (msg) => { setMensaje(msg); setTimeout(() => setMensaje(''), 5000); };

  const pagar = async (id) => {
    try {
      const res = await api.post(`/reservas/${id}/pagar`);
      mostrarMensaje(`✅ Pago exitoso. Folio: ${res.data.folio}`);
      cargar();
    } catch (err) {
      mostrarMensaje('❌ ' + (err.response?.data?.error || 'Error al pagar'));
    }
  };

  const cancelar = async (id) => {
    if (!confirm('¿Cancelar esta reserva?')) return;
    try {
      await api.delete(`/reservas/${id}`);
      mostrarMensaje('Reserva cancelada');
      cargar();
    } catch (err) {
      mostrarMensaje('❌ ' + (err.response?.data?.error || 'Error al cancelar'));
    }
  };

  const tiempoRestante = (expiresAt) => {
    const diff = new Date(expiresAt) - new Date();
    if (diff <= 0) return 'Expirada';
    const mins = Math.floor(diff / 60000);
    const segs = Math.floor((diff % 60000) / 1000);
    return `${mins}m ${segs}s`;
  };

  if (cargando) return <div className="page"><p>Cargando...</p></div>;

  return (
    <div className="page">
      <h2>Mis Reservas</h2>
      {mensaje && <div className="alert">{mensaje}</div>}

      {reservas.length === 0 ? (
        <div className="empty">No tienes reservas aún. <a href="/vuelos">Busca vuelos</a></div>
      ) : (
        <div className="reservas-list">
          {reservas.map(r => {
            const est = ESTADOS[r.estado] || ESTADOS.PENDIENTE;
            return (
              <div key={r.id} className="card reserva-card">
                <div className="reserva-header">
                  <div className="vuelo-ruta small">
                    <span>{r.vuelo.origen}</span>
                    <span>→</span>
                    <span>{r.vuelo.destino}</span>
                  </div>
                  <span className="badge" style={{ background: est.color }}>{est.label}</span>
                </div>
                <div className="reserva-info">
                  <span>📅 {new Date(r.vuelo.fechaSalida).toLocaleDateString('es-MX')}</span>
                  <span>💰 ${r.total.toLocaleString('es-MX')} MXN</span>
                  {r.estado === 'PENDIENTE' && (
                    <span className="tiempo-restante">⏱ Expira en: {tiempoRestante(r.expiresAt)}</span>
                  )}
                  {r.pago && <span>🧾 Folio: {r.pago.folio.split('-')[0].toUpperCase()}</span>}
                </div>
                <div className="reserva-acciones">
                  {r.estado === 'PENDIENTE' && (
                    <>
                      <button onClick={() => pagar(r.id)} className="btn-primary">💳 Pagar</button>
                      <button onClick={() => cancelar(r.id)} className="btn-danger">Cancelar</button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
