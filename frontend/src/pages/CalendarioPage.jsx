import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';

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

export default function CalendarioPage() {
  const hoy = new Date();
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [diasData, setDiasData] = useState({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadCalendario();
  }, [mes, anio]);

  const loadCalendario = async () => {
    setLoading(true);
    try {
      const res = await api.get('/calendario/', { params: { mes, anio } });
      setDiasData(res.data.dias);
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

  const totalDias = getDiasDelMes(anio, mes);
  const offset = primerDiaSemana(anio, mes);
  const celdas = offset + totalDias;
  const filas = Math.ceil(celdas / 7);

  const hoyDia = hoy.getDate();
  const hoyMes = hoy.getMonth() + 1;
  const hoyAnio = hoy.getFullYear();
  const esHoy = (dia) => dia === hoyDia && mes === hoyMes && anio === hoyAnio;

  const totalCuotas = Object.values(diasData).reduce((s, arr) => s + arr.length, 0);

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <h2>
          <CalendarDays size={20} style={{ marginRight: 8, verticalAlign: -2 }} />
          Calendario de Pagos
        </h2>
        {!loading && totalCuotas > 0 && (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {totalCuotas} cuota{totalCuotas !== 1 ? 's' : ''} este mes
          </span>
        )}
      </div>

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
            const cuotas = valido ? (diasData[dia] || []) : [];
            const tieneCuotas = cuotas.length > 0;
            const hayVencidas = cuotas.some(c => c.estado === 'vencida');

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
                    {cuotas.slice(0, 3).map((c, i) => (
                      <div
                        key={c.cuota_id}
                        onClick={() => navigate(`/prestamos/${c.prestamo_id}`)}
                        title={`${c.cliente_nombre} — Cuota #${c.numero_cuota}`}
                        style={{
                          background: c.estado === 'vencida'
                            ? 'var(--danger-muted)'
                            : 'var(--success-muted)',
                          color: c.estado === 'vencida'
                            ? 'var(--danger)'
                            : 'var(--success)',
                          border: `1px solid ${c.estado === 'vencida' ? 'var(--danger)' : 'var(--success)'}`,
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
          <span style={{ width: 12, height: 12, borderRadius: 2, background: 'var(--accent-muted)', border: '1px solid var(--accent)', display: 'inline-block' }} />
          Hoy
        </div>
      </div>

      {/* Resumen del mes — vista mobile friendly */}
      {!loading && totalCuotas > 0 && (
        <div style={{ marginTop: 24 }}>
          <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 10 }}>
            Detalle del mes
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {Object.entries(diasData)
              .sort(([a], [b]) => parseInt(a) - parseInt(b))
              .map(([dia, cuotas]) => (
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
                          color: 'var(--text-primary)',
                          fontWeight: 500,
                        }}>
                          {c.cliente_nombre}
                        </span>
                        <span className={`badge ${c.estado === 'vencida' ? 'badge-danger' : 'badge-success'}`}
                          style={{ fontSize: '0.7rem' }}>
                          #{c.numero_cuota}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {!loading && totalCuotas === 0 && (
        <div className="empty-state" style={{ marginTop: 32 }}>
          <CalendarDays size={40} />
          <h3>Sin pagos este mes</h3>
          <p>No hay cuotas pendientes en {MESES[mes - 1]} {anio}</p>
        </div>
      )}
    </div>
  );
}
