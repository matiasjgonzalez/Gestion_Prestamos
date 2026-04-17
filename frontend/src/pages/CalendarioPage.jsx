import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCalendario, invalidateCache } from '../services/api';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight, ChevronDown, CalendarDays, AlertTriangle, EyeOff, X } from 'lucide-react';
import { formatMoney } from '../utils/helpers';

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function getDiasDelMes(anio, mes) {
  return new Date(anio, mes, 0).getDate();
}

function primerDiaSemana(anio, mes) {
  const d = new Date(anio, mes - 1, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

// Estilo del badge de texto (desktop)
function badgeStyle(estado) {
  if (estado === 'vencida') return {
    background: 'rgba(225,29,72,0.18)',
    color: 'var(--danger)',
    border: '1px solid var(--danger)',
  };
  if (estado === 'pagada') return {
    background: 'var(--bg-secondary)',
    color: 'var(--text-muted)',
    border: '1px solid var(--border)',
  };
  return {
    background: 'rgba(22,163,74,0.18)',
    color: 'var(--success)',
    border: '1px solid var(--success)',
  };
}

function estadoBadge(estado) {
  if (estado === 'vencida') return <span className="badge badge-danger" style={{ fontSize: '0.72rem' }}>Vencida</span>;
  if (estado === 'pagada') return <span className="badge" style={{ fontSize: '0.72rem', background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>Pagada</span>;
  return <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>Pendiente</span>;
}

export default function CalendarioPage() {
  const hoy = new Date();
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [diasData, setDiasData] = useState({});
  const [vencidasAnt, setVencidasAnt] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showVencidas, setShowVencidas] = useState(false);
  const [ocultarPagadas, setOcultarPagadas] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const panelRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    setSelectedDay(null);
    loadCalendario();
  }, [mes, anio]);

  // Scroll al panel cuando se selecciona un día
  useEffect(() => {
    if (selectedDay && panelRef.current) {
      setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
    }
  }, [selectedDay]);

  const loadCalendario = async () => {
    setLoading(true);
    invalidateCache('/calendario');
    try {
      const res = await getCalendario(mes, anio);
      setDiasData(res.data.dias || {});
      setVencidasAnt(res.data.vencidas_anteriores || []);
    } catch {
      toast.error('Error al cargar el calendario');
    } finally {
      setLoading(false);
    }
  };

  const irMesAnterior = () => {
    if (mes === 1) { setMes(12); setAnio(a => a - 1); }
    else setMes(m => m - 1);
  };

  const irMesSiguiente = () => {
    if (mes === 12) { setMes(1); setAnio(a => a + 1); }
    else setMes(m => m + 1);
  };

  const irHoy = () => {
    setMes(hoy.getMonth() + 1);
    setAnio(hoy.getFullYear());
  };

  const esHoyActual = mes === hoy.getMonth() + 1 && anio === hoy.getFullYear();

  const totalDias = getDiasDelMes(anio, mes);
  const offset = primerDiaSemana(anio, mes);
  const filas = Math.ceil((offset + totalDias) / 7);

  const hoyDia = hoy.getDate();
  const esHoy = (dia) => dia === hoyDia && esHoyActual;

  const totalCuotasMes = Object.values(diasData).reduce((s, arr) => s + arr.length, 0);

  const cuotasPendientesMes = Object.values(diasData).flat().filter(c => c.estado !== 'pagada');
  const montoPendienteMes = cuotasPendientesMes.reduce((s, c) => s + (c.monto || 0), 0);

  const diasFiltrados = Object.fromEntries(
    Object.entries(diasData)
      .map(([dia, cuotas]) => [dia, ocultarPagadas ? cuotas.filter(c => c.estado !== 'pagada') : cuotas])
      .filter(([, cuotas]) => cuotas.length > 0)
  );

  // Cuotas del día seleccionado (sin filtro de pagadas para mostrar todo)
  const cuotasDiaSeleccionado = selectedDay ? (diasData[selectedDay] || []) : [];

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <h2>
          <CalendarDays size={20} style={{ marginRight: 8, verticalAlign: -2 }} />
          Calendario de Pagos
        </h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {!loading && vencidasAnt.length > 0 && (
            <span style={{ color: 'var(--danger)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertTriangle size={14} />
              {vencidasAnt.length} vencida{vencidasAnt.length !== 1 ? 's' : ''} anteriores
            </span>
          )}
          {!loading && cuotasPendientesMes.length > 0 && (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              {cuotasPendientesMes.length} pendiente{cuotasPendientesMes.length !== 1 ? 's' : ''} · <strong style={{ color: 'var(--text-primary)' }}>{formatMoney(montoPendienteMes)}</strong>
            </span>
          )}
          {!loading && totalCuotasMes > 0 && (
            <button
              className={`btn btn-sm ${ocultarPagadas ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setOcultarPagadas(v => !v)}
            >
              <EyeOff size={13} />
              {ocultarPagadas ? 'Solo pendientes' : 'Ocultar pagadas'}
            </button>
          )}
        </div>
      </div>

      {/* Vencidas anteriores — acordeón */}
      {!loading && vencidasAnt.length > 0 && (
        <div style={{ border: '1px solid var(--danger)', borderRadius: 8, marginBottom: 16, overflow: 'hidden' }}>
          <button
            onClick={() => setShowVencidas(v => !v)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', padding: '10px 14px',
              background: 'var(--danger-muted)', border: 'none',
              cursor: 'pointer', fontFamily: 'var(--font-body)',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 600, fontSize: '0.85rem', color: 'var(--danger)' }}>
              <AlertTriangle size={14} />
              {vencidasAnt.length} cuota{vencidasAnt.length !== 1 ? 's' : ''} vencida{vencidasAnt.length !== 1 ? 's' : ''} de meses anteriores
            </span>
            <ChevronDown size={16} style={{ color: 'var(--danger)', transform: showVencidas ? 'rotate(180deg)' : 'none', transition: '180ms ease', flexShrink: 0 }} />
          </button>
          {showVencidas && (
            <div style={{ background: 'var(--bg-card)', padding: '8px 14px' }}>
              {vencidasAnt.map((c, i) => (
                <div
                  key={c.cuota_id}
                  onClick={() => navigate(`/prestamos/${c.prestamo_id}`)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    cursor: 'pointer', padding: '7px 0',
                    borderBottom: i < vencidasAnt.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                    {c.cliente_nombre}
                  </span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(c.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatMoney(c.monto)}</span>
                    <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>#{c.numero_cuota}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Navegación de mes */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 14 }}>
        <button className="btn btn-secondary btn-sm" onClick={irMesAnterior}>
          <ChevronLeft size={16} />
        </button>
        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, minWidth: 170, textAlign: 'center' }}>
          {MESES[mes - 1]} {anio}
        </h3>
        <button className="btn btn-secondary btn-sm" onClick={irMesSiguiente}>
          <ChevronRight size={16} />
        </button>
        {!esHoyActual && (
          <button className="btn btn-secondary btn-sm" onClick={irHoy} style={{ marginLeft: 4 }}>
            Hoy
          </button>
        )}
      </div>

      {/* Grilla */}
      <div style={{ overflowX: 'auto' }}>
        <div className="calendario-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, minWidth: 300 }}>

          {/* Cabecera días semana */}
          {DIAS_SEMANA.map(d => (
            <div key={d} style={{
              textAlign: 'center', fontSize: '0.72rem', fontWeight: 600,
              color: 'var(--text-muted)', padding: '4px 0',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              {d}
            </div>
          ))}

          {/* Celdas */}
          {Array.from({ length: filas * 7 }).map((_, idx) => {
            const dia = idx - offset + 1;
            const valido = dia >= 1 && dia <= totalDias;
            const cuotas = valido ? (diasFiltrados[dia] || []) : [];
            const allCuotas = valido ? (diasData[dia] || []) : [];
            const montoDelDia = cuotas.filter(c => c.estado !== 'pagada').reduce((s, c) => s + (c.monto || 0), 0);
            const isSelected = selectedDay === dia;
            const tieneCuotas = allCuotas.length > 0;

            return (
              <div
                key={idx}
                className={valido ? 'cal-day-cell' : ''}
                onClick={valido ? () => setSelectedDay(isSelected ? null : dia) : undefined}
                style={{
                  background: !valido ? 'transparent'
                    : isSelected ? 'var(--accent-muted)'
                    : esHoy(dia) ? 'rgba(2,132,199,0.06)'
                    : 'var(--bg-card)',
                  border: !valido ? 'none'
                    : isSelected ? '2px solid var(--accent)'
                    : esHoy(dia) ? '1px solid var(--accent)'
                    : '1px solid var(--border)',
                  borderRadius: 6,
                  minHeight: 70,
                  padding: '4px 5px',
                  display: valido ? 'flex' : 'block',
                  flexDirection: 'column',
                  gap: 2,
                  cursor: valido ? 'pointer' : 'default',
                  transition: 'border-color 120ms, background 120ms',
                }}
              >
                {valido && (
                  <>
                    {/* Número del día */}
                    <div style={{
                      fontSize: '0.75rem',
                      fontWeight: esHoy(dia) || isSelected ? 700 : 500,
                      color: isSelected ? 'var(--accent)' : esHoy(dia) ? 'var(--accent)' : 'var(--text-secondary)',
                      marginBottom: 1,
                    }}>
                      {dia}
                    </div>

                    {/* Badges — texto en desktop, puntos en mobile */}
                    <div className="cal-badges-row">
                      {cuotas.slice(0, 4).map((c) => (
                        <div
                          key={c.cuota_id}
                          className="cal-day-badge"
                          data-estado={c.estado}
                          title={`${c.cliente_nombre} — Cuota #${c.numero_cuota} (${c.estado})`}
                          style={{
                            ...badgeStyle(c.estado),
                            borderRadius: 3,
                            fontSize: '0.65rem',
                            padding: '1px 4px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            lineHeight: 1.4,
                          }}
                        >
                          {c.cliente_nombre.split(' ').slice(0, 2).join(' ')}
                        </div>
                      ))}
                      {cuotas.length > 4 && (
                        <div className="cal-more">+{cuotas.length - 4}</div>
                      )}
                    </div>

                    {/* Monto del día (solo si hay pendientes) */}
                    {montoDelDia > 0 && (
                      <div className="cal-day-monto" style={{
                        fontSize: '0.6rem', color: 'var(--accent)',
                        fontWeight: 600, marginTop: 'auto',
                      }}>
                        {formatMoney(montoDelDia)}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Panel de día seleccionado */}
      {selectedDay && (
        <div
          ref={panelRef}
          style={{
            marginTop: 12,
            border: '2px solid var(--accent)',
            borderRadius: 10,
            background: 'var(--bg-card)',
            overflow: 'hidden',
          }}
        >
          {/* Encabezado del panel */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 14px',
            background: 'var(--accent-muted)',
            borderBottom: cuotasDiaSeleccionado.length > 0 ? '1px solid var(--border)' : 'none',
          }}>
            <strong style={{ fontSize: '0.95rem', color: 'var(--accent)' }}>
              {selectedDay} de {MESES[mes - 1]} {anio}
              {cuotasDiaSeleccionado.length > 0 && (
                <span style={{ fontWeight: 400, fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 8 }}>
                  {cuotasDiaSeleccionado.length} cuota{cuotasDiaSeleccionado.length !== 1 ? 's' : ''}
                </span>
              )}
            </strong>
            <button className="btn-icon" onClick={() => setSelectedDay(null)}>
              <X size={15} />
            </button>
          </div>

          {/* Contenido */}
          {cuotasDiaSeleccionado.length === 0 ? (
            <div style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Sin cuotas para este día
            </div>
          ) : (
            <div style={{ padding: '6px 14px 10px' }}>
              {cuotasDiaSeleccionado.map((c, i) => (
                <div
                  key={c.cuota_id}
                  onClick={() => navigate(`/prestamos/${c.prestamo_id}`)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    cursor: 'pointer', padding: '9px 0',
                    borderBottom: i < cuotasDiaSeleccionado.length - 1 ? '1px solid var(--border)' : 'none',
                    gap: 10,
                  }}
                >
                  <span style={{
                    fontSize: '0.88rem', fontWeight: 500,
                    color: c.estado === 'pagada' ? 'var(--text-muted)' : 'var(--text-primary)',
                    textDecoration: c.estado === 'pagada' ? 'line-through' : 'none',
                    flex: 1, minWidth: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {c.cliente_nombre}
                  </span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                    {c.estado !== 'pagada' && (
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {formatMoney(c.monto)}
                      </span>
                    )}
                    {estadoBadge(c.estado)}
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>#{c.numero_cuota}</span>
                  </div>
                </div>
              ))}

              {/* Total del día */}
              {cuotasDiaSeleccionado.filter(c => c.estado !== 'pagada').length > 0 && (
                <div style={{
                  display: 'flex', justifyContent: 'flex-end',
                  paddingTop: 8, marginTop: 2,
                  borderTop: '1px solid var(--border)',
                  fontSize: '0.88rem', fontWeight: 700, color: 'var(--accent)',
                }}>
                  Total a cobrar: {formatMoney(cuotasDiaSeleccionado.filter(c => c.estado !== 'pagada').reduce((s, c) => s + c.monto, 0))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Leyenda */}
      <div style={{ display: 'flex', gap: 14, marginTop: 14, flexWrap: 'wrap' }}>
        {[
          { label: 'Pendiente', bg: 'rgba(22,163,74,0.18)', border: 'var(--success)', dot: 'var(--success)' },
          { label: 'Vencida',   bg: 'rgba(225,29,72,0.18)', border: 'var(--danger)',  dot: 'var(--danger)' },
          { label: 'Pagada',    bg: 'var(--bg-secondary)',  border: 'var(--border)',  dot: 'var(--text-muted)' },
          { label: 'Hoy',       bg: 'rgba(2,132,199,0.06)', border: 'var(--accent)',  dot: 'var(--accent)' },
        ].map(({ label, bg, border, dot }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {/* Desktop: muestra el badge; Mobile: muestra el dot */}
            <span className="legend-badge-desktop" style={{ display: 'inline-block', padding: '1px 6px', borderRadius: 3, background: bg, border: `1px solid ${border}`, fontSize: '0.72rem', color: border }} />
            <span className="legend-dot-mobile" style={{ display: 'none', width: 10, height: 10, borderRadius: '50%', background: dot, flexShrink: 0 }} />
            {label}
          </div>
        ))}
      </div>

      {/* Detalle del mes */}
      {!loading && Object.keys(diasFiltrados).length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 10 }}>
            Detalle del mes
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {Object.entries(diasFiltrados)
              .sort(([a], [b]) => parseInt(a) - parseInt(b))
              .map(([dia, cuotas]) => {
                const montoTotal = cuotas.filter(c => c.estado !== 'pagada').reduce((s, c) => s + (c.monto || 0), 0);
                const isSelected = selectedDay === parseInt(dia);
                return (
                  <div
                    key={dia}
                    style={{
                      background: 'var(--bg-card)',
                      border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      cursor: 'pointer',
                    }}
                    onClick={() => setSelectedDay(isSelected ? null : parseInt(dia))}
                  >
                    <div style={{
                      minWidth: 36, textAlign: 'center', fontSize: '1.2rem',
                      fontWeight: 700, color: isSelected ? 'var(--accent)' : 'var(--accent)',
                      lineHeight: 1, paddingTop: 2,
                    }}>
                      {dia}
                      <div style={{ fontSize: '0.62rem', fontWeight: 400, color: 'var(--text-muted)' }}>
                        {MESES[mes - 1].slice(0, 3).toUpperCase()}
                      </div>
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {cuotas.map(c => (
                        <div
                          key={c.cuota_id}
                          onClick={(e) => { e.stopPropagation(); navigate(`/prestamos/${c.prestamo_id}`); }}
                          style={{
                            display: 'flex', justifyContent: 'space-between',
                            alignItems: 'center', cursor: 'pointer', padding: '2px 0',
                          }}
                        >
                          <span style={{
                            fontSize: '0.85rem',
                            color: c.estado === 'pagada' ? 'var(--text-muted)' : 'var(--text-primary)',
                            fontWeight: 500,
                            textDecoration: c.estado === 'pagada' ? 'line-through' : 'none',
                          }}>
                            {c.cliente_nombre}
                          </span>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            {c.estado !== 'pagada' && c.monto > 0 && (
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                {formatMoney(c.monto)}
                              </span>
                            )}
                            <span
                              className={`badge ${c.estado === 'vencida' ? 'badge-danger' : c.estado === 'pagada' ? '' : 'badge-success'}`}
                              style={{ fontSize: '0.7rem', ...(c.estado === 'pagada' ? { background: 'var(--bg-secondary)', color: 'var(--text-muted)' } : {}) }}
                            >
                              #{c.numero_cuota}
                            </span>
                          </div>
                        </div>
                      ))}
                      {montoTotal > 0 && (
                        <div style={{
                          borderTop: '1px solid var(--border)', paddingTop: 4, marginTop: 2,
                          display: 'flex', justifyContent: 'flex-end',
                          fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent)',
                        }}>
                          Total: {formatMoney(montoTotal)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {!loading && totalCuotasMes === 0 && vencidasAnt.length === 0 && (
        <div className="empty-state" style={{ marginTop: 32 }}>
          <CalendarDays size={40} />
          <h3>Sin pagos este mes</h3>
          <p>No hay cuotas en {MESES[mes - 1]} {anio}</p>
        </div>
      )}
    </div>
  );
}
