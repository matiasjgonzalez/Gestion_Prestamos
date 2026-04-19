import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getClientes,
  createCliente,
  updateCliente,
  deleteCliente,
  downloadExcel,
  downloadTemplate,
  importClientes,
} from '../services/api';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import toast from 'react-hot-toast';
import { Plus, Search, Pencil, Trash2, Eye, Users, Download, FileCheck, ArrowUpAZ, ArrowDownAZ, Upload, FileSpreadsheet } from 'lucide-react';
import { useDebounce } from '../utils/helpers';
import { SkeletonTable } from '../components/Skeleton';

const emptyForm = {
  nombre: '',
  apellido: '',
  dni: '',
  telefono: '',
  domicilio: '',
  empleo: '',
};

export default function ClientesPage() {
  const [clientes, setClientes] = useState([]);
  const [page, setPage] = useState(0);
  const [pageSize] = useState(10);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [sortDesc, setSortDesc] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [errors, setErrors] = useState({});
  const [confirmModal, setConfirmModal] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const importRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadClientes(debouncedSearch, page);
  }, [debouncedSearch, page, sortDesc]);

  const loadClientes = async (q = '', p = page) => {
    try {
      setLoading(true);
      const offset = p * pageSize;
      const res = await getClientes(q, { limit: pageSize, offset, sort_desc: sortDesc });
      setClientes(res.data);
    } catch {
      toast.error('Error al cargar clientes');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    setSearch(e.target.value);
    setPage(0);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setErrors({});
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
      empleo: c.empleo || '',
    });
    setErrors({});
    setShowModal(true);
  };

  const validate = () => {
    const e = {};
    if (!form.nombre.trim()) e.nombre = 'Campo requerido';
    if (!form.apellido.trim()) e.apellido = 'Campo requerido';
    if (!form.dni.trim()) e.dni = 'Campo requerido';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setSubmitting(true);
    try {
      if (editingId) {
        await updateCliente(editingId, form);
        toast.success('Cliente actualizado');
      } else {
        await createCliente(form);
        toast.success('Cliente creado');
      }
      setShowModal(false);
      loadClientes(search);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (id) => {
    setConfirmModal({
      title: '¿Eliminar cliente?',
      message: 'Esta acción eliminará el cliente y no se puede deshacer.',
      danger: true,
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await deleteCliente(id);
          toast.success('Cliente eliminado');
          loadClientes(debouncedSearch);
        } catch {
          toast.error('Error al eliminar');
        }
      },
    });
  };

  const formatTelefono = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const handleChange = (field) => (e) => {
    const value = field === 'telefono' ? formatTelefono(e.target.value) : e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleImportFile = async (e) => {
    const file = e.target.files[0];
    if (!importRef.current) return;
    importRef.current.value = '';
    if (!file) return;
    setImporting(true);
    try {
      const res = await importClientes(file);
      setImportResult(res.data);
      loadClientes(debouncedSearch, page);
    } catch (err) {
      toast.error(err.userMessage || 'Error al importar');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Clientes</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() =>
            downloadExcel('/clientes/export/zip', 'clientes.zip').catch((err) =>
              toast.error(err.message || 'Error al exportar')
            )
          }>
            <Download size={16} />Exportar ZIP
          </button>
          <button className="btn btn-secondary" onClick={downloadTemplate} title="Descargar plantilla Excel para importar">
            <FileSpreadsheet size={16} />Plantilla
          </button>
          <input ref={importRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImportFile} />
          <button className="btn btn-secondary" onClick={() => importRef.current?.click()} disabled={importing}>
            <Upload size={16} />{importing ? 'Importando...' : 'Importar Excel'}
          </button>
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} />Nuevo Cliente
          </button>
        </div>
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
        <SkeletonTable rows={6} cols={5} />
      ) : clientes.length === 0 && page === 0 ? (
        <div className="empty-state">
          <Users size={40} />
          <h3>Sin clientes</h3>
          <p>Creá tu primer cliente para empezar</p>
        </div>
      ) : clientes.length === 0 ? (
        <div className="empty-state">
          <Users size={40} />
          <h3>No hay más clientes</h3>
          <p>Ya viste todos los clientes disponibles.</p>
          <button className="btn btn-secondary" style={{ marginTop: 12 }} onClick={() => setPage(0)}>
            Volver al inicio
          </button>
        </div>
      ) : (
        <>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                      onClick={() => { setSortDesc(d => !d); setPage(0); }}>
                    Apellido
                    {sortDesc
                      ? <ArrowDownAZ size={13} style={{ marginLeft: 4, verticalAlign: -1 }} />
                      : <ArrowUpAZ size={13} style={{ marginLeft: 4, verticalAlign: -1 }} />}
                  </th>
                  <th>Nombre</th>
                  <th>DNI</th>
                  <th>Teléfono</th>
                  <th>Domicilio</th>
                  <th>Empleo</th>
                  <th>Mora</th>
                  <th>Docs</th>
                  <th style={{ width: 120 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((c) => (
                  <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/clientes/${c.id}`)}>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{c.apellido}</td>
                    <td style={{ color: 'var(--text-primary)' }}>{c.nombre}</td>
                    <td className="text-mono">{c.dni}</td>
                    <td>{c.telefono || '—'}</td>
                    <td>{c.domicilio || '—'}</td>
                    <td>{c.empleo || '—'}</td>
                    <td>
                      {c.tiene_mora
                        ? <span className="badge badge-danger">En mora</span>
                        : <span className="badge badge-success">Al día</span>}
                    </td>
                    <td>
                      {c.tiene_documentos && (
                        <FileCheck size={15} style={{ color: 'var(--success)' }} title="Tiene documentos" />
                      )}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn-icon" title="Ver" onClick={() => navigate(`/clientes/${c.id}`)}>
                          <Eye size={15} />
                        </button>
                        <button className="btn-icon" title="Editar" onClick={() => openEdit(c)}>
                          <Pencil size={15} />
                        </button>
                        <button className="btn-icon" title="Eliminar" onClick={() => handleDelete(c.id)} style={{ color: 'var(--danger)' }}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
                Anterior
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setPage((p) => p + 1)} disabled={clientes.length < pageSize}>
                Siguiente
              </button>
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Página {page + 1}</div>
          </div>
        </>
      )}

      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          danger={confirmModal.danger}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}

      {importResult && (
        <Modal title="Resultado de importación" onClose={() => setImportResult(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="stat-card" style={{ padding: '12px 16px' }}>
                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--success)' }}>{importResult.creados}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Clientes creados</div>
              </div>
              <div className="stat-card" style={{ padding: '12px 16px' }}>
                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--warning)' }}>{importResult.saltados_dni_duplicado}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>DNI duplicados (saltados)</div>
              </div>
              <div className="stat-card" style={{ padding: '12px 16px' }}>
                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--danger)' }}>{importResult.errores}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Errores</div>
              </div>
              <div className="stat-card" style={{ padding: '12px 16px' }}>
                <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{importResult.total_procesadas}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Filas procesadas</div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setImportResult(null)}>Cerrar</button>
            </div>
          </div>
        </Modal>
      )}

      {showModal && (
        <Modal
          title={editingId ? 'Editar Cliente' : 'Nuevo Cliente'}
          onClose={() => {
            const dirty = form.nombre || form.apellido || form.dni || form.telefono || form.domicilio;
            if (dirty && !window.confirm('¿Descartar cambios sin guardar?')) return;
            setShowModal(false);
          }}
        >
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Nombre</label>
                <input className={`form-control${errors.nombre ? ' input-error' : ''}`} value={form.nombre} onChange={handleChange('nombre')} />
                {errors.nombre && <span className="field-error">{errors.nombre}</span>}
              </div>
              <div className="form-group">
                <label>Apellido</label>
                <input className={`form-control${errors.apellido ? ' input-error' : ''}`} value={form.apellido} onChange={handleChange('apellido')} />
                {errors.apellido && <span className="field-error">{errors.apellido}</span>}
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>DNI</label>
                <input className={`form-control${errors.dni ? ' input-error' : ''}`} value={form.dni} onChange={handleChange('dni')} disabled={!!editingId} />
                {errors.dni && <span className="field-error">{errors.dni}</span>}
              </div>
              <div className="form-group">
                <label>Teléfono</label>
                <input className="form-control" value={form.telefono} onChange={handleChange('telefono')} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Domicilio</label>
                <input className="form-control" value={form.domicilio} onChange={handleChange('domicilio')} placeholder="Calle, número..." />
              </div>
              <div className="form-group">
                <label>Empleo / Ocupación</label>
                <input className="form-control" value={form.empleo} onChange={handleChange('empleo')} placeholder="Ej: Empleado, Comerciante..." />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Guardando...' : editingId ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
