import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPrestamos, getClientes, createPrestamo, deletePrestamo } from '../services/api';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import toast from 'react-hot-toast';
import { Plus, Trash2, Eye, Banknote, PlusCircle, MinusCircle } from 'lucide-react';
import { formatMoney } from '../utils/helpers';
import { SkeletonTable } from '../components/Skeleton';

function estadoBadge(estado) {
  if (estado === 'activo') return <span className="badge badge-default">Activo</span>;
  return <span className="badge badge-success">Finalizado</span>;
}

export default function PrestamosPage() {
  const [prestamos, setPrestamos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [page, setPage] = useState(0);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();

  const [form, setForm] = useState({ cliente_id: '', monto: '', interes_total: '', fecha_inicio: '' });
  const [cuotasDetalle, setCuotasDetalle] = useState([{ numero_cuota: 1, fecha_vencimiento: '', monto: '' }]);
  const [confirmModal, setConfirmModal] = useState(null);

  useEffect(() => { loadData(); }, [page]);

  const loadData = async (p = page) => {
    try {
      setLoading(true);
      const offset = p * pageSize;
      const [pRes, cRes] = await Promise.all([
        getPrestamos({ limit: pageSize, offset }),
        getClientes('', { limit: 1000, offset: 0 }),
      ]);
      setPrestamos(pRes.data);
      setClientes(cRes.data);
    } catch {
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setForm({ cliente_id: '', monto: '', interes_total: '', fecha_inicio: '' });
    setCuotasDetalle([{ numero_cuota: 1, fecha_vencimiento: '', monto: '' }]);
    setShowModal(true);
  };

  const addCuota = () => {
    setCuotasDetalle((prev) => [...prev, { numero_cuota: prev.length + 1, fecha_vencimiento: '', monto: '' }]);
  };

  const removeCuota = (idx) => {
    setCuotasDetalle((prev) => prev.filter((_, i) => i !== idx).map((c, i) => ({ ...c, numero_cuota: i + 1 })));
  };

  const updateCuotaField = (idx, field, value) => {
    setCuotasDetalle((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    for (const c of cuotasDetalle) {
      if (!c.fecha_vencimiento || !c.monto) { toast.error('Completá fecha y monto de todas las cuotas'); return; }
    }
    setSubmitting(true);
    const payload = {
      cliente_id: parseInt(form.cliente_id),
      monto: parseFloat(form.monto),
      interes_total: parseFloat(form.interes_total),
      cuotas: cuotasDetalle.length,
      fecha_inicio: form.fecha_inicio || null,
      cuotas_detalle: cuotasDetalle.map((c) => ({
        numero_cuota: c.numero_cuota,
        fecha_vencimiento: c.fecha_vencimiento,
        monto: parseFloat(c.monto),
      })),
    };
    try {
      await createPrestamo(payload);
      toast.success('Préstamo creado');
      setShowModal(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al crear préstamo');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (id) => {
    setConfirmModal({
      title: '¿Eliminar préstamo?',
      message: 'Se eliminarán también todas las cuotas y pagos asociados. Esta acción no se puede deshacer.',
      danger: true,
      onConfirm: async () => {
        setConfirmModal(null);
        try { await deletePrestamo(id); toast.success('Préstamo eliminado'); loadData(); }
        catch { toast.error('Error al eliminar'); }
      },
    });
  };

  const totalCuotas = cuotasDetalle.reduce((sum, c) => sum + (parseFloat(c.monto) || 0), 0);
  const getClienteName = (clienteId) => {
    const c = clientes.find((cl) => cl.id === clienteId);
    return c ? `${c.nombre} ${c.apellido}` : `#${clienteId}`;
  };

  return (
    <div>
      <div className="page-header">
        <h2>Préstamos</h2>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={16} />Nuevo Préstamo</button>
      </div>

      {loading ? (
        <SkeletonTable rows={6} cols={8} />
      ) : prestamos.length === 0 ? (
        <div className="empty-state"><Banknote size={40} /><h3>Sin préstamos</h3><p>Creá un préstamo para empezar</p></div>
      ) : (
        <>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>ID</th><th>Cliente</th><th>Monto</th><th>Interés</th><th>Cuotas</th><th>Fecha Inicio</th><th>Estado</th><th style={{ width: 100 }}>Acciones</th></tr></thead>
              <tbody>
                {prestamos.map((p) => (
                  <tr key={p.id}>
                    <td className="text-mono">#{p.id}</td>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{getClienteName(p.cliente_id)}</td>
                    <td className="text-mono">{formatMoney(p.monto)}</td>
                    <td>{p.interes_total}%</td>
                    <td>{p.cuotas}</td>
                    <td>{p.fecha_inicio || '—'}</td>
                    <td>{estadoBadge(p.estado)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn-icon" title="Ver detalle" onClick={() => navigate(`/prestamos/${p.id}`)}><Eye size={15} /></button>
                        <button className="btn-icon" title="Eliminar" onClick={() => handleDelete(p.id)} style={{ color: 'var(--danger)' }}><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
            <div>
              <button className="btn btn-sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
                Anterior
              </button>
              <button className="btn btn-sm" onClick={() => setPage((p) => p + 1)} style={{ marginLeft: 8 }}>
                Siguiente
              </button>
            </div>
            <div className="text-sm">Página {page + 1}</div>
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

      {showModal && (
        <Modal title="Nuevo Préstamo" onClose={() => setShowModal(false)} wide>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Cliente</label>
                <select className="form-control" value={form.cliente_id} onChange={(e) => setForm((f) => ({ ...f, cliente_id: e.target.value }))} required>
                  <option value="">Seleccionar...</option>
                  {clientes.map((c) => (<option key={c.id} value={c.id}>{c.nombre} {c.apellido} — DNI {c.dni}</option>))}
                </select>
              </div>
              <div className="form-group">
                <label>Fecha de Inicio</label>
                <input className="form-control" type="date" value={form.fecha_inicio} onChange={(e) => setForm((f) => ({ ...f, fecha_inicio: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Monto del Préstamo</label>
                <input className="form-control" type="number" step="0.01" value={form.monto} onChange={(e) => setForm((f) => ({ ...f, monto: e.target.value }))} placeholder="100000" required />
              </div>
              <div className="form-group">
                <label>Interés Total (%)</label>
                <input className="form-control" type="number" step="0.1" value={form.interes_total} onChange={(e) => setForm((f) => ({ ...f, interes_total: e.target.value }))} placeholder="20" required />
              </div>
            </div>

            <div style={{ marginTop: 8, marginBottom: 12 }}>
              <div className="flex-between">
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Cuotas ({cuotasDetalle.length})</label>
                <span className="text-sm text-mono" style={{ color: 'var(--accent)' }}>Total: {formatMoney(totalCuotas)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {cuotasDetalle.map((c, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '50px 1fr 1fr 36px', gap: 8, alignItems: 'center' }}>
                  <span className="text-sm text-mono" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>#{c.numero_cuota}</span>
                  <input className="form-control" type="date" value={c.fecha_vencimiento} onChange={(e) => updateCuotaField(idx, 'fecha_vencimiento', e.target.value)} required />
                  <input className="form-control" type="number" step="0.01" placeholder="Monto cuota" value={c.monto} onChange={(e) => updateCuotaField(idx, 'monto', e.target.value)} required />
                  {cuotasDetalle.length > 1 && (
                    <button type="button" className="btn-icon" onClick={() => removeCuota(idx)} style={{ color: 'var(--danger)' }}><MinusCircle size={16} /></button>
                  )}
                </div>
              ))}
            </div>

            <button type="button" className="btn btn-secondary btn-sm" onClick={addCuota} style={{ marginBottom: 8 }}>
              <PlusCircle size={14} />Agregar cuota
            </button>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Creando...' : 'Crear Préstamo'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
