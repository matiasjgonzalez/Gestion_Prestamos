import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPrestamos, getClientes, createPrestamo, deletePrestamo, downloadExcel } from '../services/api';
import { useDebounce } from '../utils/helpers';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import toast from 'react-hot-toast';
import { Plus, Trash2, Eye, Banknote, Calendar, Search, X, Download } from 'lucide-react';
import { formatMoney } from '../utils/helpers';
import { SkeletonTable } from '../components/Skeleton';

function estadoBadge(estado) {
  if (estado === 'activo') return <span className="badge badge-default">Activo</span>;
  return <span className="badge badge-success">Finalizado</span>;
}

const TIPO_DIAS = { semanal: 7, quincenal: 15, mensual: null };
const TIPOS = ['semanal', 'quincenal', 'mensual'];

function addInterval(dateStr, tipo, n) {
  const d = new Date(dateStr + 'T00:00:00');
  if (tipo === 'mensual') {
    d.setMonth(d.getMonth() + n);
  } else {
    d.setDate(d.getDate() + TIPO_DIAS[tipo] * n);
  }
  return d.toISOString().split('T')[0];
}

export default function PrestamosPage() {
  const [prestamos, setPrestamos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [clientesLoading, setClientesLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize] = useState(10);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroCliente, setFiltroCliente] = useState('');
  const debouncedFiltroCliente = useDebounce(filtroCliente, 300);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();

  const [form, setForm] = useState({ cliente_id: '', monto: '', interes_total: '', fecha_inicio: '', tipo_prestamo: 'mensual' });
  const [numCuotasStr, setNumCuotasStr] = useState('1');
  const numCuotas = Math.max(0, parseInt(numCuotasStr) || 0);
  const [fechasCuotas, setFechasCuotas] = useState(['']);
  const [confirmModal, setConfirmModal] = useState(null);
  const [clienteSearch, setClienteSearch] = useState('');
  const debouncedClienteSearch = useDebounce(clienteSearch, 300);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const clienteRef = useRef(null);
  const fechaRef = useRef(null);

  useEffect(() => { setPage(0); }, [filtroEstado, filtroTipo, debouncedFiltroCliente]);
  useEffect(() => { loadData(); }, [page, filtroEstado, filtroTipo, debouncedFiltroCliente]);

  // Búsqueda lazy de clientes al tipear en el autocomplete
  useEffect(() => {
    if (!debouncedClienteSearch || form.cliente_id) return;
    setClientesLoading(true);
    getClientes(debouncedClienteSearch, { limit: 8, offset: 0 })
      .then((r) => setClientes(r.data))
      .catch(() => {})
      .finally(() => setClientesLoading(false));
  }, [debouncedClienteSearch]);

  // Cerrar dropdown al click fuera
  useEffect(() => {
    const handler = (e) => {
      if (clienteRef.current && !clienteRef.current.contains(e.target)) {
        setShowClientDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Redimensionar array de fechas al cambiar cantidad de cuotas
  useEffect(() => {
    if (numCuotas < 1) return;
    setFechasCuotas((prev) =>
      Array.from({ length: numCuotas }, (_, i) => prev[i] || '')
    );
  }, [numCuotas]);

  // Auto-generar fechas según tipo y fecha_inicio
  useEffect(() => {
    if (!form.fecha_inicio || !numCuotas) return;
    setFechasCuotas(
      Array.from({ length: numCuotas }, (_, i) => addInterval(form.fecha_inicio, form.tipo_prestamo, i + 1))
    );
  }, [form.fecha_inicio, numCuotas, form.tipo_prestamo]);

  const loadData = async (p = page) => {
    try {
      setLoading(true);
      const params = { limit: pageSize, offset: p * pageSize };
      if (filtroEstado) params.estado = filtroEstado;
      if (filtroTipo) params.tipo_prestamo = filtroTipo;
      if (debouncedFiltroCliente) params.search = debouncedFiltroCliente;
      const res = await getPrestamos(params);
      setPrestamos(res.data);
    } catch {
      toast.error('Error al cargar préstamos');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setForm({ cliente_id: '', monto: '', interes_total: '', fecha_inicio: '', tipo_prestamo: 'mensual' });
    setNumCuotasStr('1');
    setFechasCuotas(['']);
    setClienteSearch('');
    setClientes([]);
    setShowClientDropdown(false);
    setShowModal(true);
  };

  // Cálculos derivados
  const monto = parseFloat(form.monto) || 0;
  const interes = form.interes_total !== '' ? parseFloat(form.interes_total) : null;
  const totalAPagar = (monto > 0 && interes !== null) ? Math.round(monto * (1 + interes / 100)) : 0;
  const montoPorCuota = numCuotas > 0 && totalAPagar > 0 ? Math.floor(totalAPagar / numCuotas) : 0;
  const remainder = totalAPagar - montoPorCuota * numCuotas;

  const getCuotaMonto = (idx) =>
    idx === numCuotas - 1 ? montoPorCuota + remainder : montoPorCuota;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!form.cliente_id) { toast.error('Seleccioná un cliente'); return; }
    if (!form.monto || !form.interes_total) { toast.error('Completá monto e interés'); return; }
    if (parseFloat(form.monto) <= 0) { toast.error('El monto debe ser mayor a 0'); return; }
    if (parseFloat(form.interes_total) < 0) { toast.error('El interés no puede ser negativo'); return; }
    if (numCuotas < 1) { toast.error('La cantidad de cuotas debe ser al menos 1'); return; }
    if (fechasCuotas.some((f) => !f)) { toast.error('Completá la fecha de todas las cuotas'); return; }

    setSubmitting(true);
    const payload = {
      cliente_id: parseInt(form.cliente_id),
      monto: parseFloat(form.monto),
      interes_total: parseFloat(form.interes_total),
      cuotas: numCuotas,
      tipo_prestamo: form.tipo_prestamo,
      fecha_inicio: form.fecha_inicio || null,
      cuotas_detalle: fechasCuotas.map((fecha, i) => ({
        numero_cuota: i + 1,
        fecha_vencimiento: fecha,
        monto: getCuotaMonto(i),
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

  return (
    <div>
      <div className="page-header">
        <h2>Préstamos</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-secondary"
            onClick={() => downloadExcel('/prestamos/export/xlsx', 'prestamos.xlsx')}
          >
            <Download size={16} />Exportar Excel
          </button>
          <button className="btn btn-primary" onClick={openCreate}><Plus size={16} />Nuevo Préstamo</button>
        </div>
      </div>

      {/* Filtros */}
      <div className="filter-bar">
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="form-control filter-select"
            style={{ paddingLeft: 32, minWidth: 200 }}
            placeholder="Buscar cliente..."
            value={filtroCliente}
            onChange={(e) => setFiltroCliente(e.target.value)}
          />
        </div>
        <select
          className="form-control filter-select"
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="activo">Activo</option>
          <option value="finalizado">Finalizado</option>
        </select>
        <select
          className="form-control filter-select"
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
        >
          <option value="">Todos los tipos</option>
          <option value="mensual">Mensual</option>
          <option value="quincenal">Quincenal</option>
          <option value="semanal">Semanal</option>
        </select>
        {(filtroEstado || filtroTipo || filtroCliente) && (
          <button className="btn btn-secondary btn-sm" onClick={() => { setFiltroEstado(''); setFiltroTipo(''); setFiltroCliente(''); }}>
            <X size={14} /> Limpiar
          </button>
        )}
      </div>

      {loading ? (
        <SkeletonTable rows={6} cols={8} />
      ) : prestamos.length === 0 && page === 0 ? (
        <div className="empty-state"><Banknote size={40} /><h3>Sin préstamos</h3><p>Creá un préstamo para empezar</p></div>
      ) : prestamos.length === 0 ? (
        <div className="empty-state">
          <Banknote size={40} />
          <h3>No hay más préstamos</h3>
          <p>Ya viste todos los préstamos disponibles.</p>
          <button className="btn btn-secondary" style={{ marginTop: 12 }} onClick={() => setPage(0)}>
            Volver al inicio
          </button>
        </div>
      ) : (
        <>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>ID</th><th>Cliente</th><th>Monto</th><th>Interés</th><th>Cuotas</th><th>Fecha Inicio</th><th>Estado</th><th style={{ width: 100 }}>Acciones</th></tr></thead>
              <tbody>
                {prestamos.map((p) => (
                  <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/prestamos/${p.id}`)}>
                    <td className="text-mono">#{p.id}</td>
                    <td>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{p.cliente_nombre || `#${p.cliente_id}`}</div>
                      <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>DNI {p.cliente_dni}</div>
                    </td>
                    <td className="text-mono">{formatMoney(p.monto)}</td>
                    <td>{p.interes_total}%</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <span style={{ fontSize: '0.8rem' }}>{p.cuotas_pagadas ?? 0}/{p.cuotas_total ?? p.cuotas}</span>
                        <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, width: 56 }}>
                          <div style={{
                            height: '100%',
                            background: p.cuotas_pagadas === (p.cuotas_total ?? p.cuotas) ? 'var(--success)' : 'var(--accent)',
                            borderRadius: 2,
                            width: `${p.cuotas_total ? Math.round((p.cuotas_pagadas / p.cuotas_total) * 100) : 0}%`,
                            transition: 'width 0.3s',
                          }} />
                        </div>
                      </div>
                    </td>
                    <td>{p.fecha_inicio || '—'}</td>
                    <td>{estadoBadge(p.estado)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>Anterior</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setPage((p) => p + 1)} disabled={prestamos.length < pageSize}>Siguiente</button>
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

      {showModal && (
        <Modal title="Nuevo Préstamo" onClose={() => {
          const dirty = form.cliente_id || form.monto || form.interes_total;
          if (dirty && !window.confirm('¿Descartar el préstamo sin guardar?')) return;
          setShowModal(false);
        }} wide>
          <form onSubmit={handleSubmit}>

            {/* Tipo de préstamo */}
            <div className="form-group">
              <label>Tipo de Préstamo</label>
              <div className="tipo-selector">
                {TIPOS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`tipo-btn ${form.tipo_prestamo === t ? 'active' : ''}`}
                    onClick={() => setForm((f) => ({ ...f, tipo_prestamo: t }))}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Cliente + Fecha */}
            <div className="form-row">
              <div className="form-group">
                <label>Cliente</label>
                <div className="cliente-search-wrapper" ref={clienteRef}>
                  <div className="cliente-search-input-wrap">
                    <Search size={15} className="cliente-search-icon" />
                    <input
                      className="form-control cliente-search-input"
                      placeholder="Buscar por nombre o DNI..."
                      value={clienteSearch}
                      onChange={(e) => {
                        setClienteSearch(e.target.value);
                        setShowClientDropdown(true);
                        if (!e.target.value) {
                          setForm((f) => ({ ...f, cliente_id: '' }));
                          setClientes([]);
                        }
                      }}
                      onFocus={() => setShowClientDropdown(true)}
                      autoComplete="off"
                    />
                    {form.cliente_id && (
                      <button type="button" className="cliente-clear-btn" onClick={() => {
                        setClienteSearch('');
                        setForm((f) => ({ ...f, cliente_id: '' }));
                      }}>
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  {showClientDropdown && clienteSearch && (
                    <div className="cliente-dropdown">
                      {clientesLoading ? (
                        <div className="cliente-dropdown-empty">Buscando...</div>
                      ) : clientes.length === 0 ? (
                        <div className="cliente-dropdown-empty">Sin resultados para "{clienteSearch}"</div>
                      ) : (
                        clientes.map((c) => (
                          <button
                            type="button"
                            key={c.id}
                            className={`cliente-dropdown-item ${form.cliente_id === c.id ? 'selected' : ''}`}
                            onClick={() => {
                              setForm((f) => ({ ...f, cliente_id: c.id }));
                              setClienteSearch(`${c.nombre} ${c.apellido}`);
                              setShowClientDropdown(false);
                            }}
                          >
                            <span className="cliente-item-nombre">{c.nombre} {c.apellido}</span>
                            <span className="cliente-item-dni">DNI {c.dni}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="form-group">
                <label>Fecha de Inicio</label>
                <div className="date-input-wrap">
                  <input
                    ref={fechaRef}
                    className="form-control date-input"
                    type="date"
                    value={form.fecha_inicio}
                    onChange={(e) => setForm((f) => ({ ...f, fecha_inicio: e.target.value }))}
                  />
                  <button
                    type="button"
                    className="date-icon-btn"
                    onClick={() => fechaRef.current?.showPicker?.() ?? fechaRef.current?.click()}
                    tabIndex={-1}
                  >
                    <Calendar size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Monto + Interés + Cuotas */}
            <div className="form-row-3">
              <div className="form-group">
                <label>Monto del Préstamo</label>
                <input
                  className="form-control no-spinner"
                  type="number"
                  value={form.monto}
                  onChange={(e) => setForm((f) => ({ ...f, monto: e.target.value }))}
                  min="1"
                  placeholder="100000"
                  required
                />
              </div>
              <div className="form-group">
                <label>Interés Total (%)</label>
                <input
                  className="form-control no-spinner"
                  type="number"
                  value={form.interes_total}
                  onChange={(e) => setForm((f) => ({ ...f, interes_total: e.target.value }))}
                  placeholder="20"
                  required
                />
              </div>
              <div className="form-group">
                <label>Cantidad de Cuotas</label>
                <input
                  className="form-control no-spinner"
                  type="number"
                  min="1"
                  value={numCuotasStr}
                  onChange={(e) => setNumCuotasStr(e.target.value)}
                  onBlur={(e) => {
                    const n = Math.max(1, parseInt(e.target.value) || 1);
                    setNumCuotasStr(String(n));
                  }}
                  required
                />
              </div>
            </div>

            {/* Resumen del cálculo */}
            {totalAPagar > 0 && (
              <div className="cuota-calc-info">
                <span>Total a pagar: <strong>{formatMoney(totalAPagar)}</strong></span>
                <span>
                  {numCuotas} cuota{numCuotas !== 1 ? 's' : ''} de{' '}
                  <strong>{formatMoney(montoPorCuota)}</strong>
                  {remainder > 0 && <span className="text-muted"> (última: {formatMoney(montoPorCuota + remainder)})</span>}
                </span>
              </div>
            )}

            {/* Fechas de vencimiento por cuota */}
            {numCuotas > 0 && totalAPagar > 0 && (
              <div className="cuotas-fechas-section">
                <label className="cuotas-fechas-label">Fechas de vencimiento</label>
                <div className="cuotas-fechas-grid">
                  {fechasCuotas.map((fecha, idx) => (
                    <div key={idx} className="cuota-fecha-row">
                      <span className="cuota-num">#{idx + 1}</span>
                      <div className="date-input-wrap" style={{ flex: 1 }}>
                        <input
                          className="form-control date-input"
                          type="date"
                          value={fecha}
                          onChange={(e) =>
                            setFechasCuotas((prev) =>
                              prev.map((f, i) => (i === idx ? e.target.value : f))
                            )
                          }
                          required
                        />
                      </div>
                      <span className="cuota-monto-display">{formatMoney(getCuotaMonto(idx))}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
