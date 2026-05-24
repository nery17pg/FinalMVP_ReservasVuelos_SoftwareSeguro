import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Vuelos() {
  const [vuelos, setVuelos] = useState([]);
  const [filtros, setFiltros] = useState({ origen: '', destino: '' });
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const { usuario } = useAuth();

  const buscar = async () => {
    setCargando(true);
    try {
      const params = new URLSearchParams();
      if (filtros.origen) params.append('origen', filtros.origen);
      if (filtros.destino) params.append('destino', filtros.destino);
      const res = await api.get(`/vuelos?${params}`);
      setVuelos(res.data.vuelos);
    } catch (err) {
      setMensaje('Error al buscar vuelos');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { buscar(); }, []);

  const reservar = async (vueloId) => {
    if (!usuario) return (window.location.href = '/login');
    try {
      await api.post('/reservas', { vueloId });
      setMensaje('✅ Reserva creada. Tienes 10 minutos para pagar.');
      buscar(); // actualizar asientos disponibles
    } catch (err) {
      setMensaje('❌ ' + (err.response?.data?.error || 'Error al reservar'));
    }
    setTimeout(() => setMensaje(''), 5000);
  };

  return (
    <div className="page">
      <h2>Buscar Vuelos</h2>

      <div className="search-bar">
        <input
          placeholder="Origen (ej: Ciudad de México)"
          value={filtros.origen}
          onChange={e => setFiltros({ ...filtros, origen: e.target.value })}
        />
        <input
          placeholder="Destino (ej: Cancún)"
          value={filtros.destino}
          onChange={e => setFiltros({ ...filtros, destino: e.target.value })}
        />
        <button onClick={buscar} className="btn-primary" disabled={cargando}>
          {cargando ? 'Buscando...' : '🔍 Buscar'}
        </button>
      </div>

      {mensaje && <div className="alert">{mensaje}</div>}

      <div className="vuelos-grid">
        {vuelos.length === 0 && !cargando && (
          <div className="empty">No hay vuelos disponibles con esos filtros.</div>
        )}
        {vuelos.map(v => (
          <div key={v.id} className="card vuelo-card">
            <div className="vuelo-ruta">
              <span className="ciudad">{v.origen}</span>
              <span className="flecha">✈</span>
              <span className="ciudad">{v.destino}</span>
            </div>
            <div className="vuelo-info">
              <span>📅 {new Date(v.fechaSalida).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              <span>💺 {v.asientosDisponibles} asientos</span>
            </div>
            <div className="vuelo-footer">
              <span className="precio">${v.precio.toLocaleString('es-MX')} MXN</span>
              {usuario?.role === 'CLIENT' && (
                <button onClick={() => reservar(v.id)} className="btn-primary">
                  Reservar
                </button>
              )}
              {!usuario && (
                <button onClick={() => (window.location.href = '/login')} className="btn-secondary">
                  Login para reservar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
