import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const vueloVacio = { origen: '', destino: '', fechaSalida: '', precio: '', asientosDisponibles: '' };

export default function Admin() {
  const { usuario } = useAuth();
  const [tab, setTab] = useState('vuelos');
  const [vuelos, setVuelos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [form, setForm] = useState(vueloVacio);
  const [editandoId, setEditandoId] = useState(null);
  const [mensaje, setMensaje] = useState('');

  const msg = (m) => { setMensaje(m); setTimeout(() => setMensaje(''), 5000); };

  useEffect(() => {
    if (tab === 'vuelos') api.get('/vuelos/todos').then(r => setVuelos(r.data.vuelos)).catch(() => {});
    if (tab === 'usuarios') api.get('/admin/usuarios').then(r => setUsuarios(r.data.usuarios)).catch(() => {});
    if (tab === 'reservas') api.get('/reservas/admin/todas').then(r => setReservas(r.data.reservas)).catch(() => {});
  }, [tab]);

  const guardarVuelo = async (e) => {
    e.preventDefault();
    try {
      if (editandoId) {
        await api.put(`/vuelos/${editandoId}`, form);
        msg('✅ Vuelo actualizado');
      } else {
        await api.post('/vuelos', form);
        msg('✅ Vuelo creado');
      }
      setForm(vueloVacio);
      setEditandoId(null);
      const res = await api.get('/vuelos/todos');
      setVuelos(res.data.vuelos);
    } catch (err) {
      msg('❌ ' + (err.response?.data?.error || 'Error'));
    }
  };

  const editarVuelo = (v) => {
    setForm({
      origen: v.origen,
      destino: v.destino,
      fechaSalida: new Date(v.fechaSalida).toISOString().slice(0, 16),
      precio: v.precio,
      asientosDisponibles: v.asientosDisponibles,
    });
    setEditandoId(v.id);
  };

  const eliminarVuelo = async (id) => {
    if (!confirm('¿Eliminar vuelo?')) return;
    try {
      await api.delete(`/vuelos/${id}`);
      setVuelos(vuelos.filter(v => v.id !== id));
      msg('Vuelo eliminado');
    } catch (err) {
      msg('❌ ' + (err.response?.data?.error || 'Error'));
    }
  };

  const cambiarRol = async (id, role) => {
    try {
      await api.put(`/admin/usuarios/${id}/role`, { role });
      setUsuarios(usuarios.map(u => u.id === id ? { ...u, role } : u));
    } catch (err) {
      msg('❌ ' + (err.response?.data?.error || 'Error'));
    }
  };

  const eliminarUsuario = async (id) => {
    if (!confirm('¿Eliminar usuario?')) return;
    try {
      await api.delete(`/admin/usuarios/${id}`);
      setUsuarios(usuarios.filter(u => u.id !== id));
    } catch (err) {
      msg('❌ ' + (err.response?.data?.error || 'Error'));
    }
  };

  return (
    <div className="page">
      <h2>Panel de Administración</h2>
      {mensaje && <div className="alert">{mensaje}</div>}

      <div className="tabs">
        <button onClick={() => setTab('vuelos')} className={tab === 'vuelos' ? 'tab active' : 'tab'}>✈ Vuelos</button>
        {usuario?.role === 'ADMIN' && (
          <>
            <button onClick={() => setTab('usuarios')} className={tab === 'usuarios' ? 'tab active' : 'tab'}>👥 Usuarios</button>
            <button onClick={() => setTab('reservas')} className={tab === 'reservas' ? 'tab active' : 'tab'}>📋 Reservas</button>
          </>
        )}
      </div>

      {/* TAB VUELOS */}
      {tab === 'vuelos' && (
        <div>
          <h3>{editandoId ? 'Editar vuelo' : 'Nuevo vuelo'}</h3>
          <form onSubmit={guardarVuelo} className="form-grid">
            <input placeholder="Origen" value={form.origen} onChange={e => setForm({ ...form, origen: e.target.value })} required />
            <input placeholder="Destino" value={form.destino} onChange={e => setForm({ ...form, destino: e.target.value })} required />
            <input type="datetime-local" value={form.fechaSalida} onChange={e => setForm({ ...form, fechaSalida: e.target.value })} required />
            <input type="number" placeholder="Precio" value={form.precio} onChange={e => setForm({ ...form, precio: e.target.value })} required min="0" />
            <input type="number" placeholder="Asientos disponibles" value={form.asientosDisponibles} onChange={e => setForm({ ...form, asientosDisponibles: e.target.value })} required min="0" />
            <div className="form-acciones">
              <button type="submit" className="btn-primary">{editandoId ? 'Actualizar' : 'Crear'}</button>
              {editandoId && <button type="button" onClick={() => { setForm(vueloVacio); setEditandoId(null); }} className="btn-secondary">Cancelar</button>}
            </div>
          </form>

          <table className="tabla">
            <thead>
              <tr><th>Origen</th><th>Destino</th><th>Salida</th><th>Precio</th><th>Asientos</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {vuelos.map(v => (
                <tr key={v.id}>
                  <td>{v.origen}</td>
                  <td>{v.destino}</td>
                  <td>{new Date(v.fechaSalida).toLocaleDateString('es-MX')}</td>
                  <td>${v.precio.toLocaleString()}</td>
                  <td>{v.asientosDisponibles}</td>
                  <td>
                    <button onClick={() => editarVuelo(v)} className="btn-sm">Editar</button>
                    {usuario?.role === 'ADMIN' && (
                      <button onClick={() => eliminarVuelo(v.id)} className="btn-sm danger">Eliminar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB USUARIOS */}
      {tab === 'usuarios' && usuario?.role === 'ADMIN' && (
        <div>
          <h3>Gestión de usuarios</h3>
          <table className="tabla">
            <thead>
              <tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {usuarios.map(u => (
                <tr key={u.id}>
                  <td>{u.nombre}</td>
                  <td>{u.email}</td>
                  <td>
                    <select value={u.role} onChange={e => cambiarRol(u.id, e.target.value)} disabled={u.id === usuario.id}>
                      <option value="CLIENT">CLIENT</option>
                      <option value="STAFF">STAFF</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </td>
                  <td>
                    {u.id !== usuario.id && (
                      <button onClick={() => eliminarUsuario(u.id)} className="btn-sm danger">Eliminar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB RESERVAS */}
      {tab === 'reservas' && usuario?.role === 'ADMIN' && (
        <div>
          <h3>Todas las reservas</h3>
          <table className="tabla">
            <thead>
              <tr><th>Usuario</th><th>Vuelo</th><th>Total</th><th>Estado</th><th>Folio</th></tr>
            </thead>
            <tbody>
              {reservas.map(r => (
                <tr key={r.id}>
                  <td>{r.usuario?.nombre}</td>
                  <td>{r.vuelo?.origen} → {r.vuelo?.destino}</td>
                  <td>${r.total.toLocaleString()}</td>
                  <td>{r.estado}</td>
                  <td>{r.pago?.folio?.split('-')[0].toUpperCase() || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
