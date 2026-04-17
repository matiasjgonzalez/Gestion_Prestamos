import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCalendario, invalidateCache } from '../services/api';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight, ChevronDown, CalendarDays, AlertTriangle, EyeOff } from 'lucide-react';
import { formatMoney } from '../utils/helpers';

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function getDiasDelMes(anio, mes) {
  return new Date(anio, mes, 0).getDate();
}

// 0=Dom,1=Lun...6=Sáb -> convertir a Lun=0..Dom=6
function primerDiaSemana(anio, mes) {
  const d = new Date(anio, mes - 1, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

function badgeStyle(estado) {
  if (estado === 'vencida') return {
    background: 'var(--danger-muted)',
    color: 'var(--danger)',
    border: '1px solid var(--danger)',
  };
  if (estado === 'pagada') return {
    background: 'var(--bg-secondary)',
    color: 'var(--text-muted)',
    border: '1px solid var(--border)',
  };
  // pendiente
  return {
    background: 'var(--success-muted)',
    color: 'var(--success)',
    border: '1px solid var(--success)',
  };
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
  const navigate = useNavigate();

  useEffect(() => {
    loadCalendario();
  }, [mes, anio]);

  const loadCalendario = async () => {
    setLoading(true);
    invalidateCache('/calendario');
    try {
      const res = await getCalendario(mes, anio);
      setDiasData(res.data.dias || {});
      setVencidasAnt(res.data.vencidas_anteriores || []);
    } catch (err) {
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

  const totalDias = getDiasDelMes(anio, mes);
  const offset = primerDiaSemana(anio, mes);
  const celdas = offset + totalDias;
  const filas = Math.ceil(celdas / 7);

  const hoyDia = hoy.getDate();
  const hoyMes = hoy.getMonth() + 1;
  const hoyAnio = hoy.getFullYear();
  const esHoy = (dia) => dia === hoyDia && mes === hoyMes && anio === hoyAnio;

  const totalCuotasMes = Object.values(diasData).reduce((s, arr) => s + arr.length, 0);

  // Stats del mes: cuotas pendientes/vencidas y su monto total
  const cuotasPendientesMes = Object.values(diasData)
    .flat()
    .filter(c => c.estado !== 'pagada');
  const montoPendienteMes = cuotasPendientesMes.reduce((s, c) => s + (c.monto || 0), 0);

  // Días filtrados según toggle "ocultar pagadas"
  const diasFiltrados = Object.fromEntries(
    Object.entries(diasData).map(([dia, cuotas]) => [
      dia,
      ocultarPagadas ? cuotas.filter(c => c.estado !== 'pagada') : cuotas,
    ]).filter(([, cuotas]) => cuotas.length > 0)
  );

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <h2>
          <CalendarDays size={20} style={{ marginRight: 8, verticalAlign: -2 }} />
          Calendario de Pagos
        </h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
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
              title={ocultarPagadas ? 'Mostrar pagadas' : 'Ocultar pagadas'}
            >
              <EyeOff size={13} />
              {ocultarPagadas ? 'Mostrando solo pendientes' : 'Ocultar pagadas'}
            </button>
          )}
        </div>
      </div>

      {/* Vencidas de meses anteriores — acordeón */}
      {!loading && vencidasAnt.length > 0 && (
        <div style={{
          border: '1px solid var(--danger)',
          borderRadius: 8,
          marginBottom: 16,
          overflow: 'hidden',
        }}>
          {/* Cabecera — siempre visible */}
          <button
            onClick={() => setShowVencidas(v => !v)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              background: 'var(--danger-muted)',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 600, fontSize: '0.85rem', color: 'var(--danger)' }}>
              <AlertTriangle size={14} />
              {vencidasAnt.length} cuota{vencidasAnt.length !== 1 ? 's' : ''} vencida{vencidasAnt.length !== 1 ? 's' : ''} de meses anteriores
            </span>
            <ChevronDown
              size={16}
              style={{
                color: 'var(--danger)',
                transform: showVencidas ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: '180ms ease',
                flexShrink: 0,
              }}
            />
          </button>

          {/* Lista — solo visible si expandido */}
          {showVencidas && (
            <div style={{ background: 'var(--bg-card)', padding: '8px 14px' }}>
              {vencidasAnt.map((c, i) => (
                <div
                  key={c.cuota_id}
                  onClick={() => navigate(`/prestamos/${c.prestamo_id}`)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    padding: '7px 0',
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
                    <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>
                      #{c.numero_cuota}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Navegación de mes */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 16, marginBottom: 16,
      }}>
        <button className="btn btn-secondary btn-sm" onClick={irMesAnterior}>
          <ChevronLeft size={16} />
        </button>
        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, minWidth: 180, textAlign: 'center' }}>
          {MESES[mes - 1]} {anio}
        </h3>
        <button className="btn btn-secondary btn-sm" onClick={irMesSiguiente}>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Grilla */}
      <div style={{ overflowX: 'auto' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 3,
          minWidth: 300,
        }}>
          {/* Cabecera días semana */}
          {DIAS_SEMANA.map(d => (
            <div key={d} style={{
              textAlign: 'center',
              fontSize: '0.72rem',
              fontWeight: 600,
              color: 'var(--text-muted)',
              padding: '4px 0',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              {d}
            </div>
          ))}

          {/* Celdas */}
          {Array.from({ length: filas * 7 }).map((_, idx) => {
            const dia = idx - offset + 1;
            const valido = dia >= 1 && dia <= totalDias;
            const cuotas = valido ? (diasFiltrados[dia] || []) : [];
            const montoDelDia = cuotas.filter(c => c.estado !== 'pagada').reduce((s, c) => s + (c.monto || 0), 0);

            return (
              <div key={idx} style={{
                background: !valido
                  ? 'transparent'
                  : esHoy(dia)
                    ? 'var(--accent-muted)'
                    : 'var(--bg-card)',
                border: !valido
                  ? 'none'
                  : esHoy(dia)
                    ? '1px solid var(--accent)'
                    : '1px solid var(--border)',
                borderRadius: 6,
                minHeight: 70,
                padding: '4px 5px',
                display: valido ? 'flex' : 'block',
                flexDirection: 'column',
                gap: 2,
              }}>
                {valido && (
                  <>
                    {/* Número del día */}
                    <div style={{
                      fontSize: '0.75rem',
                      fontWeight: esHoy(dia) ? 700 : 500,
                      color: esHoy(dia) ? 'var(--accent)' : 'var(--text-secondary)',
                      marginBottom: 2,
                    }}>
                      {dia}
                    </div>

                    {/* Badges de clientes */}
                    {cuotas.slice(0, 3).map((c) => (
                      <div
                        key={c.cuota_id}
                        onClick={() => navigate(`/prestamos/${c.prestamo_id}`)}
                        title={`${c.cliente_nombre} — Cuota #${c.numero_cuota} (${c.estado})`}
                        style={{
                          ...badgeStyle(c.estado),
                          borderRadius: 3,
                          fontSize: '0.65rem',
                          padding: '1px 4px',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          lineHeight: 1.4,
                        }}
                      >
                        {c.cliente_nombre.split(' ').slice(0, 2).join(' ')}
                      </div>
                    ))}

                    {/* +N si hay más */}
                    {cuotas.length > 3 && (
                      <div style={{
                        fontSize: '0.62rem',
                        color: 'var(--text-muted)',
                        paddingLeft: 2,
                      }}>
                        +{cuotas.length - 3} más
                      </div>
                    )}

                    {/* Monto total pendiente del día */}
                    {montoDelDia > 0 && (
                      <div style={{
                        fontSize: '0.62rem',
                        color: 'var(--accent)',
                        fontWeight: 600,
                        paddingLeft: 2,
                        marginTop: 'auto',
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

      {/* Leyenda */}
      <div style={{ display: 'flex', gap: 16, marginTop: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <span style={{ width: 12, height: 12, borderRadius: 2, background: 'var(--success-muted)', border: '1px solid var(--success)', display: 'inline-block' }} />
          Pendiente
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <span style={{ width: 12, height: 12, borderRadius: 2, background: 'var(--danger-muted)', border: '1px solid var(--danger)', display: 'inline-block' }} />
          Vencida
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <span style={{ width: 12, height: 12, borderRadius: 2, background: 'var(--bg-secondary)', border: '1px solid var(--border)', display: 'inline-block' }} />
          Pagada
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <span style={{ width: 12, height: 12, borderRadius: 2, background: 'var(--accent-muted)', border: '1px solid var(--accent)', display: 'inline-block' }} />
          Hoy
        </div>
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
                return (
                  <div key={dia} style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                  }}>
                    <div style={{
                      minWidth: 36,
                      textAlign: 'center',
                      fontSize: '1.2rem',
                      fontWeight: 700,
                      color: 'var(--accent)',
                      lineHeight: 1,
                      paddingTop: 2,
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
                          onClick={() => navigate(`/prestamos/${c.prestamo_id}`)}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer',
                            padding: '2px 0',
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
                              style={{
                                fontSize: '0.7rem',
                                ...(c.estado === 'pagada' ? { background: 'var(--bg-secondary)', color: 'var(--text-muted)' } : {}),
                              }}
                            >
                              #{c.numero_cuota}
                            </span>
                          </div>
                        </div>
                      ))}
                      {montoTotal > 0 && (
                        <div style={{
                          borderTop: '1px solid var(--border)',
                          paddingTop: 4,
                          marginTop: 2,
                          display: 'flex',
                          justifyContent: 'flex-end',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          color: 'var(--accent)',
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

      {!loading && totalCuotasMes === 0 && vencidasAnt.length === 0 && Object.keys(diasFiltrados).length === 0 && (
        <div className="empty-state" style={{ marginTop: 32 }}>
          <CalendarDays size={40} />
          <h3>Sin pagos este mes</h3>
          <p>No hay cuotas en {MESES[mes - 1]} {anio}</p>
        </div>
      )}
    </div>
  );
}
