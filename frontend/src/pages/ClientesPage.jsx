import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getClientes,
  createCliente,
  updateCliente,
  deleteCliente,
} from '../services/api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { Plus, Search, Pencil, Trash2, Eye, Users } from 'lucide-react';

const emptyForm = {
  nombre: '',
  apellido: '',
  dni: '',
  telefono: '',
  domicilio: '',
  score_riesgo: '',
};

export default function ClientesPage() {
  const [clientes, setClientes] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const navigate = useNavigate();

  useEffect(() => {
    loadClientes();
  }, []);

  const loadClientes = async (q = '') => {
    try {
      const res = await getClientes(q);
      setClientes(res.data);
    } catch {
      toast.error('Error al cargar clientes');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    const val = e.target.value;
    setSearch(val);
    loadClientes(val);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setShowModal(true);
  };

  const openEdit = (c) => {
    setEditingId(c.id);
    setForm({
      nombre: c.nombre,
      apellido: c.apellido,
      dni: c.dni,
      telefono: c.telefono || '',
      domicilio: c.domicilio || '',
      score_riesgo: c.score_riesgo ?? '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      score_riesgo: form.score_riesgo === '' ? null : parseFloat(form.score_riesgo),
    };
    try {
      if (editingId) {
        await updateCliente(editingId, payload);
        toast.success('Cliente actualizado');
      } else {
        await createCliente(payload);
        toast.success('Cliente creado');
      }
      setShowModal(false);
      loadClientes(search);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este cliente?')) return;
    try {
      await deleteCliente(id);
      toast.success('Cliente eliminado');
      loadClientes(search);
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const handleChange = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  return (
    <div>
      <div className="page-header">
        <h2>Clientes</h2>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus size={16} />
          Nuevo Cliente
        </button>
      </div>

      <div className="search-bar">
        <Search />
        <input
          className="form-control"
          placeholder="Buscar por nombre, apellido o DNI..."
          value={search}
          onChange={handleSearch}
        />
      </div>

      {loading ? (
        <div className="empty-state"><p>Cargando...</p></div>
      ) : clientes.length === 0 ? (
        <div className="empty-state">
          <Users size={40} />
          <h3>Sin clientes</h3>
          <p>Creá tu primer cliente para empezar</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>DNI</th>
                <th>Teléfono</th>
                <th>Domicilio</th>
                <th>Score</th>
                <th style={{ width: 120 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id}>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                    {c.nombre} {c.apellido}
                  </td>
                  <td className="text-mono">{c.dni}</td>
                  <td>{c.telefono || '—'}</td>
                  <td>{c.domicilio || '—'}</td>
                  <td>
                    {c.score_riesgo != null ? (
                      <span className="text-mono">{c.score_riesgo}</span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn-icon"
                        title="Ver"
                        onClick={() => navigate(`/clientes/${c.id}`)}
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        className="btn-icon"
                        title="Editar"
                        onClick={() => openEdit(c)}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        className="btn-icon"
                        title="Eliminar"
                        onClick={() => handleDelete(c.id)}
                        style={{ color: 'var(--danger)' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal
          title={editingId ? 'Editar Cliente' : 'Nuevo Cliente'}
          onClose={() => setShowModal(false)}
        >
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Nombre</label>
                <input
                  className="form-control"
                  value={form.nombre}
                  onChange={handleChange('nombre')}
                  required
                />
              </div>
              <div className="form-group">
                <label>Apellido</label>
                <input
                  className="form-control"
                  value={form.apellido}
                  onChange={handleChange('apellido')}
                  required
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>DNI</label>
                <input
                  className="form-control"
                  value={form.dni}
                  onChange={handleChange('dni')}
                  required
                  disabled={!!editingId}
                />
              </div>
              <div className="form-group">
                <label>Teléfono</label>
                <input
                  className="form-control"
                  value={form.telefono}
                  onChange={handleChange('telefono')}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Domicilio</label>
              <input
                className="form-control"
                value={form.domicilio}
                onChange={handleChange('domicilio')}
              />
            </div>
            <div className="form-group">
              <label>Score de Riesgo</label>
              <input
                className="form-control"
                type="number"
                step="0.1"
                value={form.score_riesgo}
                onChange={handleChange('score_riesgo')}
                placeholder="Ej: 7.5"
              />
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowModal(false)}
              >
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary">
                {editingId ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
