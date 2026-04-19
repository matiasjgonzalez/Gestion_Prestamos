import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getPrestamoCompleto,
  registrarPago,
  marcarCuotaPagada,
  desmarcarCuotaPagada,
  cancelarPrestamo,
  updateCuota,
  refinanciarPrestamo,
  invalidateCache,
  updateNotas,
} from '../services/api';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import toast from 'react-hot-toast';
import { ArrowLeft, DollarSign, Calendar, Hash, CheckCircle, Pencil, RotateCcw, GitMerge, ChevronDown, ChevronUp, FileText, Save } from 'lucide-react';
import { formatMoney } from '../utils/helpers';
import { SkeletonCards, SkeletonTable } from '../components/Skeleton';

function cuotaBadge(estado, parcial) {
  if (parcial) return <span className="badge badge-warning">Pago parcial</span>;
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
  const [confirmModal, setConfirmModal] = useState(null);
  const [editCuota, setEditCuota] = useState(null); // {id, numero_cuota, fecha_vencimiento, _original}
  const [showAllCuotas, setShowAllCuotas] = useState(false);
  const [notas, setNotas] = useState('');
  const [notasDirty, setNotasDirty] = useState(false);
  const [savingNotas, setSavingNotas] = useState(false);
  const [showRefinanciarModal, setShowRefinanciarModal] = useState(false);
  const [refForm, setRefForm] = useState({ numCuotas: '1', montoPorCuota: '', fechaInicio: '', tipo: 'mensual' });
  const [refFechas, setRefFechas] = useState(['']);
  const CUOTAS_PAGE = 10;

  useEffect(() => { loadData(); }, [id]);

  const loadData = async () => {
    try {
      const res = await getPrestamoCompleto(id);
      setData(res.data);
      setNotas(res.data.prestamo?.notas || '');
      setNotasDirty(false);
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
    const monto = parseFloat(pagoMonto);
    if (!monto || monto <= 0) { toast.error('El monto debe ser mayor a 0'); return; }
    if (monto > deuda_restante + 0.01) {
      toast.error(`El monto supera la deuda restante (${formatMoney(deuda_restante)})`);
      return;
    }
    setSubmitting(true);
    try {
      await registrarPago({
        prestamo_id: parseInt(id),
        monto_pagado: monto,
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

  const handleMarcarCuota = (cuotaId, numeroCuota) => {
    if (submitting) return;
    setConfirmModal({
      title: `¿Marcar cuota #${numeroCuota} como pagada?`,
      message: 'Podés deshacer esta acción desde la misma cuota si te equivocás.',
      danger: false,
      onConfirm: async () => {
        setConfirmModal(null);
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
      },
    });
  };

  const handleDesmarcarCuota = (cuotaId, numeroCuota) => {
    if (submitting) return;
    setConfirmModal({
      title: `¿Desmarcar cuota #${numeroCuota}?`,
      message: 'La cuota volverá a estado pendiente o vencida y se eliminará el pago automático registrado.',
      danger: true,
      onConfirm: async () => {
        setConfirmModal(null);
        setSubmitting(true);
        try {
          await desmarcarCuotaPagada(id, cuotaId);
          toast.success(`Cuota #${numeroCuota} desmarcada`);
          reload();
        } catch (err) {
          toast.error(err.response?.data?.detail || 'Error');
        } finally {
          setSubmitting(false);
        }
      },
    });
  };

  const handleEditCuota = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload = { fecha_vencimiento: editCuota.fecha_vencimiento };
      if (editCuota.monto !== editCuota._originalMonto) {
        const m = parseFloat(editCuota.monto);
        if (!m || m <= 0) { toast.error('El monto debe ser mayor a 0'); setSubmitting(false); return; }
        payload.monto = m;
      }
      await updateCuota(id, editCuota.id, payload);
      toast.success(`Cuota #${editCuota.numero_cuota} actualizada`);
      setEditCuota(null);
      reload();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al actualizar');
    } finally {
      setSubmitting(false);
    }
  };

  const TIPO_DIAS = { semanal: 7, quincenal: 15, mensual: null };
  const addInterval = (dateStr, tipo, n) => {
    const d = new Date(dateStr + 'T00:00:00');
    if (tipo === 'mensual') d.setMonth(d.getMonth() + n);
    else d.setDate(d.getDate() + TIPO_DIAS[tipo] * n);
    return d.toISOString().split('T')[0];
  };

  const openRefinanciar = () => {
    if (!data) return;
    const sorted = [...data.cuotas_rel].sort((a, b) => a.numero_cuota - b.numero_cuota);
    const lastCuota = sorted[sorted.length - 1];
    const avgMonto = sorted.length > 0 ? Math.round(sorted.reduce((s, c) => s + Number(c.monto), 0) / sorted.length) : '';
    const tipo = data.prestamo.tipo_prestamo || 'mensual';
    const fechaInicio = lastCuota ? addInterval(lastCuota.fecha_vencimiento, tipo, 1) : '';
    setRefForm({ numCuotas: '1', montoPorCuota: String(avgMonto), fechaInicio, tipo });
    setRefFechas(fechaInicio ? [fechaInicio] : ['']);
    setShowRefinanciarModal(true);
  };

  const handleRefNumCuotas = (val) => {
    const n = Math.max(1, parseInt(val) || 1);
    setRefForm((f) => ({ ...f, numCuotas: String(n) }));
    if (refForm.fechaInicio) {
      setRefFechas(Array.from({ length: n }, (_, i) => addInterval(refForm.fechaInicio, refForm.tipo, i)));
    } else {
      setRefFechas(Array.from({ length: n }, () => ''));
    }
  };

  const handleRefFechaInicio = (val) => {
    const n = Math.max(1, parseInt(refForm.numCuotas) || 1);
    setRefForm((f) => ({ ...f, fechaInicio: val }));
    if (val) setRefFechas(Array.from({ length: n }, (_, i) => addInterval(val, refForm.tipo, i)));
  };

  const handleRefinanciar = async (e) => {
    e.preventDefault();
    if (submitting) return;
    const n = parseInt(refForm.numCuotas) || 0;
    if (n < 1 || !refForm.montoPorCuota || refFechas.some((f) => !f)) {
      toast.error('Completá todos los campos'); return;
    }
    setSubmitting(true);
    try {
      const cuotasDetalle = refFechas.map((fecha, i) => ({
        numero_cuota: i + 1,
        fecha_vencimiento: fecha,
        monto: parseFloat(refForm.montoPorCuota),
      }));
      await refinanciarPrestamo(id, cuotasDetalle);
      toast.success(`${n} cuota${n > 1 ? 's' : ''} agregada${n > 1 ? 's' : ''} al préstamo`);
      setShowRefinanciarModal(false);
      reload();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al refinanciar');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelar = () => {
    if (submitting) return;
    setConfirmModal({
      title: '¿Cancelar el préstamo?',
      message: 'Se marcarán todas las cuotas pendientes como pagadas. Esta acción no se puede deshacer.',
      danger: true,
      onConfirm: async () => {
        setConfirmModal(null);
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
      },
    });
  };

  if (loading) return (
    <div>
      <SkeletonCards count={4} />
      <SkeletonTable rows={5} cols={5} />
    </div>
  );
  if (!data) return (
    <div className="empty-state" style={{ marginTop: 60 }}>
      <h3>Préstamo no encontrado</h3>
      <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => navigate('/prestamos')}>
        Volver a Préstamos
      </button>
    </div>
  );

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
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => setShowPagoModal(true)} disabled={submitting}>
              <DollarSign size={16} />Registrar Pago
            </button>
            <button className="btn btn-secondary" onClick={openRefinanciar} disabled={submitting} title="Agregar cuotas al préstamo">
              <GitMerge size={16} />Refinanciar
            </button>
            <button className="btn btn-secondary" onClick={handleCancelar} disabled={submitting} title="Marcar todo como pagado">
              <CheckCircle size={16} />Cancelar
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
            <label>Tipo</label>
            <span style={{ textTransform: 'capitalize' }}>{prestamo.tipo_prestamo || 'Mensual'}</span>
          </div>
          <div className="detail-item">
            <label>Estado</label>
            {prestamo.estado === 'activo'
              ? <span className="badge badge-default">Activo</span>
              : <span className="badge badge-success">Finalizado</span>}
          </div>
        </div>
      </div>

      {/* Notas */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h3 style={{ fontSize: '1.05rem', margin: 0 }}>
            <FileText size={16} style={{ marginRight: 6, verticalAlign: -2 }} />Notas
          </h3>
          {notasDirty && (
            <button
              className="btn btn-primary btn-sm"
              disabled={savingNotas}
              onClick={async () => {
                setSavingNotas(true);
                try {
                  await updateNotas(id, notas);
                  toast.success('Notas guardadas');
                  setNotasDirty(false);
                  invalidateCache(`/prestamos/${id}`);
                } catch {
                  toast.error('Error al guardar notas');
                } finally {
                  setSavingNotas(false);
                }
              }}
            >
              <Save size={13} />
              {savingNotas ? 'Guardando...' : 'Guardar'}
            </button>
          )}
        </div>
        <textarea
          className="form-control"
          rows={4}
          placeholder="Ej: Cuota 4 — interés por mora $40.000. Cuota 6 — interés $60.000..."
          value={notas}
          onChange={(e) => { setNotas(e.target.value); setNotasDirty(true); }}
          style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: '0.88rem', lineHeight: 1.6 }}
        />
      </div>

      {/* Cuotas */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ fontSize: '1.05rem', margin: 0 }}>
          <Calendar size={16} style={{ marginRight: 6, verticalAlign: -2 }} />Cuotas ({cuotas_rel.length})
        </h3>
        {cuotas_rel.length > CUOTAS_PAGE && (
          <button className="btn btn-secondary btn-sm" onClick={() => setShowAllCuotas((v) => !v)}>
            {showAllCuotas ? <><ChevronUp size={13} /> Ver menos</> : <><ChevronDown size={13} /> Ver todas ({cuotas_rel.length})</>}
          </button>
        )}
      </div>
      <div className="table-wrapper mb-16">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Vencimiento</th>
              <th>Monto</th>
              <th>Estado</th>
              {prestamo.estado === 'activo' && <th style={{ width: 100 }}>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {(showAllCuotas ? cuotas_rel : cuotas_rel.slice(0, CUOTAS_PAGE)).map((c) => {
              const parcial = c.estado !== 'pagada' && c.monto_efectivo != null && c.monto_efectivo < c.monto && c.monto_efectivo > 0;
              return (
              <tr key={c.id}>
                <td className="text-mono">{c.numero_cuota}</td>
                <td>{new Date(c.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                <td className="text-mono">
                  {parcial ? (
                    <span>
                      {formatMoney(c.monto_efectivo)}{' '}
                      <span className="text-muted" style={{ fontSize: '0.78rem', textDecoration: 'line-through' }}>
                        {formatMoney(c.monto)}
                      </span>
                    </span>
                  ) : formatMoney(c.monto)}
                </td>
                <td>{cuotaBadge(c.estado, parcial)}</td>
                {prestamo.estado === 'activo' && (
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {c.estado !== 'pagada' && (
                      <button
                        className="btn-icon"
                        title="Editar fecha"
                        onClick={() => setEditCuota({ id: c.id, numero_cuota: c.numero_cuota, fecha_vencimiento: c.fecha_vencimiento, _original: c.fecha_vencimiento, monto: String(c.monto), _originalMonto: String(c.monto) })}
                        disabled={submitting}
                      >
                        <Pencil size={13} />
                      </button>
                      )}
                      {c.estado !== 'pagada' ? (
                        <button
                          className="btn-icon"
                          style={{ color: 'var(--success)' }}
                          onClick={() => handleMarcarCuota(c.id, c.numero_cuota)}
                          disabled={submitting}
                          title="Marcar como pagada"
                        >
                          <CheckCircle size={13} />
                        </button>
                      ) : (
                        <button
                          className="btn-icon"
                          style={{ color: 'var(--text-muted)' }}
                          onClick={() => handleDesmarcarCuota(c.id, c.numero_cuota)}
                          disabled={submitting}
                          title="Desmarcar (revertir pago)"
                        >
                          <RotateCcw size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
              );
            })}
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

      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          danger={confirmModal.danger}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}

      {/* Modal editar cuota */}
      {editCuota && (
        <Modal title={`Editar Cuota #${editCuota.numero_cuota} — solo esta cuota`} onClose={() => {
          const dirty = editCuota.fecha_vencimiento !== editCuota._original || editCuota.monto !== editCuota._originalMonto;
          if (dirty && !window.confirm('¿Descartar cambios?')) return;
          setEditCuota(null);
        }}>
          <form onSubmit={handleEditCuota}>
            <div className="form-row">
              <div className="form-group">
                <label>Fecha de Vencimiento</label>
                <input
                  className="form-control"
                  type="date"
                  value={editCuota.fecha_vencimiento}
                  onChange={(e) => setEditCuota((prev) => ({ ...prev, fecha_vencimiento: e.target.value }))}
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Monto</label>
                <input
                  className="form-control no-spinner"
                  type="number"
                  min="1"
                  step="0.01"
                  value={editCuota.monto}
                  onChange={(e) => setEditCuota((prev) => ({ ...prev, monto: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div style={{ fontSize: '0.79rem', color: 'var(--text-muted)', marginBottom: 8 }}>
              Solo se modifica esta cuota. Las demás quedan sin cambios.
            </div>
            {editCuota.monto !== editCuota._originalMonto && (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                Monto original: <strong>{formatMoney(parseFloat(editCuota._originalMonto))}</strong>
                {' → '}
                Nuevo: <strong style={{ color: 'var(--accent)' }}>{formatMoney(parseFloat(editCuota.monto) || 0)}</strong>
              </div>
            )}
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setEditCuota(null)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal refinanciar */}
      {showRefinanciarModal && (
        <Modal title="Refinanciar Préstamo" onClose={() => setShowRefinanciarModal(false)}>
          <form onSubmit={handleRefinanciar}>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>
              Se agregarán nuevas cuotas al préstamo existente.
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Cantidad de cuotas</label>
                <input className="form-control no-spinner" type="number" min="1" value={refForm.numCuotas}
                  onChange={(e) => handleRefNumCuotas(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Monto por cuota</label>
                <input className="form-control no-spinner" type="number" min="1" step="0.01" value={refForm.montoPorCuota}
                  onChange={(e) => setRefForm((f) => ({ ...f, montoPorCuota: e.target.value }))} required />
              </div>
            </div>
            <div className="form-group">
              <label>Fecha primera cuota</label>
              <input className="form-control" type="date" value={refForm.fechaInicio}
                onChange={(e) => handleRefFechaInicio(e.target.value)} required />
            </div>
            {refFechas.length > 0 && refForm.montoPorCuota && (
              <div className="cuotas-fechas-section">
                <label className="cuotas-fechas-label">Fechas de vencimiento</label>
                <div className="cuotas-fechas-grid">
                  {refFechas.map((fecha, idx) => (
                    <div key={idx} className="cuota-fecha-row">
                      <span className="cuota-num">#{idx + 1}</span>
                      <input className="form-control date-input" type="date" value={fecha}
                        onChange={(e) => setRefFechas((prev) => prev.map((f, i) => i === idx ? e.target.value : f))} required />
                      <span className="cuota-monto-display">${Number(refForm.montoPorCuota).toLocaleString('es-AR')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowRefinanciarModal(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Guardando...' : 'Agregar cuotas'}
              </button>
            </div>
          </form>
        </Modal>
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
                max={new Date().toISOString().slice(0, 16)}
                onChange={(e) => setPagoFecha(e.target.value)} />
            </div>
            <div style={{
              background: 'var(--accent-muted)', borderRadius: 'var(--radius-sm)',
              padding: '12px 14px', fontSize: '0.82rem', color: 'var(--accent)', marginTop: 8,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>Deuda restante: <strong>{formatMoney(deuda_restante)}</strong></span>
              <button type="button" style={{ fontSize: '0.78rem', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                onClick={() => setPagoMonto(String(deuda_restante))}>
                Pagar todo
              </button>
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
