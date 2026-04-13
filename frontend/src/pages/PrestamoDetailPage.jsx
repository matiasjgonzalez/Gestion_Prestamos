import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getPrestamoCompleto,
  registrarPago,
  marcarCuotaPagada,
  cancelarPrestamo,
  invalidateCache,
} from '../services/api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { ArrowLeft, DollarSign, Calendar, Hash, CheckCircle, XCircle } from 'lucide-react';

function formatMoney(n) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}

function cuotaBadge(estado) {
  switch (estado) {
    case 'pagada': return <span className="badge badge-success">Pagada</span>;
    case 'vencida': return <span className="badge badge-danger">Vencida</span>;
    default: return <span className="badge badge-warning">Pendiente</span>;
  }
}

export default function PrestamoDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [pagoMonto, setPagoMonto] = useState('');
  const [pagoFecha, setPagoFecha] = useState('');

  useEffect(() => { loadData(); }, [id]);

  const loadData = async () => {
    try {
      const res = await getPrestamoCompleto(id);
      setData(res.data);
    } catch {
      toast.error('Error al cargar préstamo');
      navigate('/prestamos');
    } finally {
      setLoading(false);
    }
  };

  const reload = () => {
    invalidateCache(`/prestamos/${id}`);
    setLoading(true);
    loadData();
  };

  const handlePago = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await registrarPago({
        prestamo_id: parseInt(id),
        monto_pagado: parseFloat(pagoMonto),
        fecha_pago: pagoFecha ? new Date(pagoFecha).toISOString() : null,
      });
      toast.success('Pago registrado');
      setShowPagoModal(false);
      setPagoMonto('');
      setPagoFecha('');
      reload();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al registrar pago');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarcarCuota = async (cuotaId, numeroCuota) => {
    if (submitting) return;
    if (!window.confirm(`¿Marcar cuota #${numeroCuota} como pagada?`)) return;
    setSubmitting(true);
    try {
      await marcarCuotaPagada(id, cuotaId);
      toast.success(`Cuota #${numeroCuota} marcada como pagada`);
      reload();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelar = async () => {
    if (submitting) return;
    if (!window.confirm('¿Cancelar el préstamo completo? Se marcarán todas las cuotas como pagadas.')) return;
    setSubmitting(true);
    try {
      await cancelarPrestamo(id);
      toast.success('Préstamo cancelado — todas las cuotas marcadas como pagadas');
      reload();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="empty-state"><p>Cargando...</p></div>;
  if (!data) return null;

  const { prestamo, cliente, cuotas_rel, pagos, deuda_restante, total_cuotas, total_pagado } = data;

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn-icon" onClick={() => navigate('/prestamos')}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2>Préstamo #{prestamo.id}</h2>
            {cliente && (
              <span className="text-sm text-muted">
                {cliente.nombre} {cliente.apellido} — DNI {cliente.dni}
              </span>
            )}
          </div>
        </div>
        {prestamo.estado === 'activo' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={() => setShowPagoModal(true)} disabled={submitting}>
              <DollarSign size={16} />Registrar Pago
            </button>
            <button className="btn btn-secondary" onClick={handleCancelar} disabled={submitting} title="Marcar todo como pagado">
              <CheckCircle size={16} />Cancelar Préstamo
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="card-grid">
        <div className="stat-card">
          <div className="stat-label">Monto Prestado</div>
          <div className="stat-value">{formatMoney(prestamo.monto)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total a Pagar</div>
          <div className="stat-value accent">{formatMoney(total_cuotas)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Pagado</div>
          <div className="stat-value success">{formatMoney(total_pagado)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Deuda Restante</div>
          <div className={`stat-value ${deuda_restante > 0 ? 'danger' : 'success'}`}>
            {formatMoney(deuda_restante)}
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="card mb-16">
        <div className="detail-grid">
          <div className="detail-item"><label>Interés Total</label><span>{prestamo.interes_total}%</span></div>
          <div className="detail-item"><label>Cantidad de Cuotas</label><span>{prestamo.cuotas}</span></div>
          <div className="detail-item"><label>Fecha Inicio</label><span>{prestamo.fecha_inicio || '—'}</span></div>
          <div className="detail-item">
            <label>Estado</label>
            {prestamo.estado === 'activo'
              ? <span className="badge badge-default">Activo</span>
              : <span className="badge badge-success">Finalizado</span>}
          </div>
        </div>
      </div>

      {/* Cuotas */}
      <h3 style={{ marginBottom: 12, fontSize: '1.05rem' }}>
        <Calendar size={16} style={{ marginRight: 6, verticalAlign: -2 }} />Cuotas
      </h3>
      <div className="table-wrapper mb-16">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Vencimiento</th>
              <th>Monto</th>
              <th>Estado</th>
              {prestamo.estado === 'activo' && <th style={{ width: 80 }}>Acción</th>}
            </tr>
          </thead>
          <tbody>
            {cuotas_rel.map((c) => (
              <tr key={c.id}>
                <td className="text-mono">{c.numero_cuota}</td>
                <td>{new Date(c.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                <td className="text-mono">{formatMoney(c.monto)}</td>
                <td>{cuotaBadge(c.estado)}</td>
                {prestamo.estado === 'activo' && (
                  <td>
                    {c.estado !== 'pagada' && (
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleMarcarCuota(c.id, c.numero_cuota)}
                        disabled={submitting}
                        title="Marcar como pagada"
                      >
                        <CheckCircle size={14} />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagos */}
      <h3 style={{ marginBottom: 12, fontSize: '1.05rem' }}>
        <Hash size={16} style={{ marginRight: 6, verticalAlign: -2 }} />Historial de Pagos
      </h3>
      {pagos.length === 0 ? (
        <div className="card">
          <div className="empty-state" style={{ padding: '30px 20px' }}>
            <p className="text-muted">Sin pagos registrados</p>
          </div>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead><tr><th>ID</th><th>Fecha</th><th>Monto</th><th>Días Atraso</th></tr></thead>
            <tbody>
              {pagos.map((p) => (
                <tr key={p.id}>
                  <td className="text-mono">#{p.id}</td>
                  <td>{new Date(p.fecha_pago).toLocaleDateString('es-AR')}</td>
                  <td className="text-mono">{formatMoney(p.monto_pagado)}</td>
                  <td>
                    {p.dias_atraso > 0
                      ? <span className="badge badge-danger">{p.dias_atraso} días</span>
                      : <span className="badge badge-success">En término</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal pago */}
      {showPagoModal && (
        <Modal title="Registrar Pago" onClose={() => setShowPagoModal(false)}>
          <form onSubmit={handlePago}>
            <div className="form-group">
              <label>Monto del Pago</label>
              <input className="form-control" type="number" step="0.01" value={pagoMonto}
                onChange={(e) => setPagoMonto(e.target.value)} placeholder="Ej: 40000" required autoFocus />
            </div>
            <div className="form-group">
              <label>Fecha del Pago (opcional, por defecto hoy)</label>
              <input className="form-control" type="datetime-local" value={pagoFecha}
                onChange={(e) => setPagoFecha(e.target.value)} />
            </div>
            <div style={{
              background: 'var(--accent-muted)', borderRadius: 'var(--radius-sm)',
              padding: '12px 14px', fontSize: '0.82rem', color: 'var(--accent)', marginTop: 8,
            }}>
              Deuda restante: <strong>{formatMoney(deuda_restante)}</strong>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowPagoModal(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Registrando...' : 'Registrar'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
