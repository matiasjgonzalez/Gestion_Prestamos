import { useState, useEffect } from 'react';
import { getDashboard, invalidateCache } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Filter, X, CalendarCheck, Clock } from 'lucide-react';
import { formatMoney } from '../utils/helpers';
import { SkeletonCards, SkeletonTable } from '../components/Skeleton';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const COLORS_COBRADO = ['#16A34A', '#0284C7'];
const COLORS_ESTADO  = ['#16A34A', '#D97706', '#E11D48'];
const COLORS_TIPO    = ['#0284C7', '#7C3AED', '#D97706'];

const ESTADO_LABEL = { pagada: 'Pagadas', pendiente: 'Pendientes', vencida: 'Vencidas' };
const TIPO_LABEL   = { semanal: 'Semanal', quincenal: 'Quincenal', mensual: 'Mensual' };
const MESES_LABEL  = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

const hoy = new Date();
const ANIO_ACTUAL = hoy.getFullYear();
const ANIOS = Array.from({ length: ANIO_ACTUAL - 2022 }, (_, i) => 2023 + i).concat([ANIO_ACTUAL, ANIO_ACTUAL + 1]);

function primerDiaDelMes(anio, mes) {
  return `${anio}-${String(mes).padStart(2, '0')}-01`;
}
function ultimoDiaDelMes(anio, mes) {
  return new Date(anio, mes, 0).toISOString().split('T')[0];
}

function CustomTooltipMoney({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <span className="chart-tooltip-label">{payload[0].name}</span>
      <span className="chart-tooltip-value">{formatMoney(payload[0].value)}</span>
    </div>
  );
}

function CustomTooltipCuotas({ active, payload, total }) {
  if (!active || !payload?.length) return null;
  const pct = total > 0 ? Math.round((payload[0].value / total) * 100) : 0;
  return (
    <div className="chart-tooltip">
      <span className="chart-tooltip-label">{payload[0].name}</span>
      <span className="chart-tooltip-value">{payload[0].value} de {total}</span>
      <span className="chart-tooltip-pct">{pct}%</span>
    </div>
  );
}

function CustomTooltipCount({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <span className="chart-tooltip-label">{payload[0].payload?.tipo ?? payload[0].name}</span>
      <span className="chart-tooltip-value">{payload[0].value} préstamos</span>
    </div>
  );
}

function renderEstadoLegend(estadosData, total) {
  const colorMap = { Pagadas: '#16A34A', Pendientes: '#D97706', Vencidas: '#E11D48' };
  return (
    <div className="chart-legend">
      {estadosData.map((e) => (
        <div key={e.name} className="chart-legend-item">
          <span className="chart-legend-dot" style={{ background: colorMap[e.name] }} />
          <span className="chart-legend-name">{e.name}</span>
          <span className="chart-legend-count">{e.value} de {total}</span>
        </div>
      ))}
    </div>
  );
}

function MonthYearSelect({ label, mes, anio, onMes, onAnio }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{label}</span>
      <select
        className="form-control filter-select"
        value={mes}
        onChange={(e) => onMes(parseInt(e.target.value))}
        style={{ minWidth: 110 }}
      >
        {MESES_LABEL.map((m, i) => (
          <option key={i + 1} value={i + 1}>{m}</option>
        ))}
      </select>
      <select
        className="form-control filter-select"
        value={anio}
        onChange={(e) => onAnio(parseInt(e.target.value))}
        style={{ minWidth: 80 }}
      >
        {ANIOS.map((a) => (
          <option key={a} value={a}>{a}</option>
        ))}
      </select>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // UI state (lo que el usuario está seleccionando)
  const [mesDesde, setMesDesde]   = useState(hoy.getMonth() + 1);
  const [anioDesde, setAnioDesde] = useState(ANIO_ACTUAL);
  const [mesHasta, setMesHasta]   = useState(hoy.getMonth() + 1);
  const [anioHasta, setAnioHasta] = useState(ANIO_ACTUAL);

  // Filtro aplicado (null = sin filtro, objeto = filtro activo)
  const [filtroAplicado, setFiltroAplicado] = useState(null);

  useEffect(() => { loadData(filtroAplicado); }, [filtroAplicado]);

  const loadData = async (filtro) => {
    setLoading(true);
    invalidateCache('/prestamos/dashboard');
    try {
      const params = filtro
        ? { fecha_desde: filtro.desde, fecha_hasta: filtro.hasta }
        : {};
      const res = await getDashboard(params);
      setData(res.data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  const aplicarFiltro = () => {
    setFiltroAplicado({
      desde: primerDiaDelMes(anioDesde, mesDesde),
      hasta: ultimoDiaDelMes(anioHasta, mesHasta),
      labelDesde: `${MESES_LABEL[mesDesde - 1]} ${anioDesde}`,
      labelHasta: `${MESES_LABEL[mesHasta - 1]} ${anioHasta}`,
    });
  };

  const limpiarFiltro = () => setFiltroAplicado(null);

  const rangoLabel = filtroAplicado
    ? `${filtroAplicado.labelDesde} — ${filtroAplicado.labelHasta}`
    : null;

  if (loading) return (
    <div>
      <div className="page-header"><h2>Dashboard</h2></div>
      <SkeletonCards count={5} />
      <SkeletonTable rows={3} cols={5} />
    </div>
  );
  if (!data) return null;

  const moraData = data.mora;

  const f = !!filtroAplicado;
  const stats = [
    { label: f ? 'Prestado en el período'    : 'Total Prestado',        value: formatMoney(data.total_prestado), colorClass: '' },
    { label: f ? 'Cobrado en el período'     : 'Total Cobrado',         value: formatMoney(data.total_cobrado),  colorClass: 'success' },
    { label: f ? 'Deuda pendiente'           : 'Deuda Total',           value: formatMoney(data.deuda_total),    colorClass: 'accent' },
    { label: f ? 'Préstamos del período'     : 'Préstamos Activos',     value: data.prestamos_activos,           colorClass: '' },
    { label: f ? 'Clientes del período'      : 'Clientes c/ Préstamos', value: data.clientes_con_prestamos,      colorClass: '' },
  ];

  // Gráfico cobros últimos 12 meses — completar meses vacíos con 0
  const cobrosMap = {};
  (data.cobros_por_mes || []).forEach(r => { cobrosMap[`${r.anio}-${r.mes}`] = r.total; });
  const cobrosChart = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - 11 + i, 1);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    return { label: `${MESES_CORTO[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, total: cobrosMap[key] || 0 };
  });

  const cobradoData = [
    { name: 'Cobrado',   value: data.total_cobrado },
    { name: 'Pendiente', value: Math.max(0, data.deuda_total) },
  ];

  const estadosData = (data.cuotas_por_estado || [])
    .sort((a, b) => ['pagada','pendiente','vencida'].indexOf(a.estado) - ['pagada','pendiente','vencida'].indexOf(b.estado))
    .map((r) => ({ name: ESTADO_LABEL[r.estado] ?? r.estado, value: r.cantidad }));
  const totalCuotas = estadosData.reduce((s, r) => s + r.value, 0);

  const tiposData = (data.prestamos_por_tipo || []).map((r) => ({
    tipo: TIPO_LABEL[r.tipo] ?? r.tipo,
    cantidad: r.cantidad,
  }));

  return (
    <div>
      <div className="page-header">
        <h2>Dashboard</h2>
        {rangoLabel && (
          <span style={{
            fontSize: '0.82rem',
            color: 'var(--accent)',
            background: 'var(--accent-muted)',
            border: '1px solid var(--accent)',
            borderRadius: 20,
            padding: '3px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <Filter size={12} />
            {rangoLabel}
          </span>
        )}
      </div>

      {/* Filtro rango */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '12px 16px',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}>
        <MonthYearSelect
          label="Desde"
          mes={mesDesde}
          anio={anioDesde}
          onMes={setMesDesde}
          onAnio={setAnioDesde}
        />
        <MonthYearSelect
          label="Hasta"
          mes={mesHasta}
          anio={anioHasta}
          onMes={setMesHasta}
          onAnio={setAnioHasta}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={aplicarFiltro}>
            <Filter size={14} />
            Filtrar
          </button>
          {filtroAplicado && (
            <button className="btn btn-secondary btn-sm" onClick={limpiarFiltro}>
              <X size={14} />
              Ver todo
            </button>
          )}
        </div>
      </div>

      {/* Widget cobros del día */}
      {!filtroAplicado && ((data.cobros_hoy?.length > 0) || (data.cobros_manana?.length > 0)) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'Cobros de hoy', items: data.cobros_hoy || [], icon: <CalendarCheck size={15}/>, color: 'var(--success)', bg: 'var(--success-muted)', border: 'var(--success)' },
            { label: 'Cobros de mañana', items: data.cobros_manana || [], icon: <Clock size={15}/>, color: 'var(--accent)', bg: 'var(--accent-muted)', border: 'var(--accent)' },
          ].map(({ label, items, icon, color, bg, border }) => items.length > 0 && (
            <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: '0.82rem', color, marginBottom: 8 }}>
                {icon}{label} ({items.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {items.map(c => (
                  <div key={c.cuota_id} onClick={() => navigate(`/prestamos/${c.prestamo_id}`)}
                    style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer', fontSize: '0.82rem', padding: '2px 0' }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{c.cliente_nombre}</span>
                    <span style={{ color, fontWeight: 600 }}>${Number(c.monto).toLocaleString('es-AR')}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stat cards */}
      <div className="card-grid">
        {stats.map((s, i) => (
          <div className="stat-card" key={i}>
            <div className="stat-label">{s.label}</div>
            <div className={`stat-value ${s.colorClass}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Gráfico cobros por mes */}
      {!filtroAplicado && cobrosChart.some(r => r.total > 0) && (
        <div className="chart-card" style={{ marginBottom: 16 }}>
          <div className="chart-title">Cobros últimos 12 meses</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={cobrosChart} barSize={22}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} width={55} />
              <Tooltip
                formatter={(v) => [`$${Number(v).toLocaleString('es-AR')}`, 'Cobrado']}
                contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.8rem' }}
                cursor={{ fill: 'var(--accent-muted)' }}
              />
              <Bar dataKey="total" fill="#0284C7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Charts */}
      <div className="charts-grid">

        <div className="chart-card">
          <div className="chart-title">Cobrado vs Pendiente</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={cobradoData}
                cx="50%" cy="50%"
                innerRadius={60} outerRadius={90}
                paddingAngle={3} dataKey="value"
              >
                {cobradoData.map((_, i) => <Cell key={i} fill={COLORS_COBRADO[i]} />)}
              </Pie>
              <Tooltip content={<CustomTooltipMoney />} />
              <Legend iconType="circle" iconSize={10} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <div className="chart-title">Cuotas por Estado</div>
          {estadosData.length === 0 ? (
            <div className="chart-empty">Sin datos</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={estadosData}
                    cx="50%" cy="50%"
                    innerRadius={58} outerRadius={85}
                    paddingAngle={3} dataKey="value"
                  >
                    {estadosData.map((entry, i) => {
                      const colorMap = { Pagadas: '#16A34A', Pendientes: '#D97706', Vencidas: '#E11D48' };
                      return <Cell key={i} fill={colorMap[entry.name] ?? COLORS_ESTADO[i % 3]} />;
                    })}
                  </Pie>
                  <Tooltip content={<CustomTooltipCuotas total={totalCuotas} />} />
                  <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
                    <tspan x="50%" dy="-8" style={{ fontSize: 22, fontWeight: 700, fill: 'var(--text-primary)' }}>{totalCuotas}</tspan>
                    <tspan x="50%" dy="22" style={{ fontSize: 11, fill: 'var(--text-muted)' }}>total</tspan>
                  </text>
                </PieChart>
              </ResponsiveContainer>
              {renderEstadoLegend(estadosData, totalCuotas)}
            </>
          )}
        </div>

        <div className="chart-card">
          <div className="chart-title">Préstamos por Tipo</div>
          {tiposData.length === 0 ? (
            <div className="chart-empty">Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={tiposData} barSize={40}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="tipo" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltipCount />} cursor={{ fill: 'var(--accent-muted)' }} />
                <Bar dataKey="cantidad" radius={[4, 4, 0, 0]}>
                  {tiposData.map((_, i) => <Cell key={i} fill={COLORS_TIPO[i % 3]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

      </div>

      {/* Mora */}
      {moraData && moraData.total_en_mora > 0 && (
        <div className="card" style={{ marginTop: 8 }}>
          <div className="flex-between mb-16">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={18} className="text-danger" />
              Cuotas en Mora ({moraData.total_en_mora})
            </h3>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/mora')}>
              Ver todas
            </button>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Préstamo</th>
                  <th>Cuota</th>
                  <th>Monto</th>
                  <th>Días atraso</th>
                </tr>
              </thead>
              <tbody>
                {moraData.cuotas.slice(0, 5).map((c) => (
                  <tr key={c.cuota_id}>
                    <td style={{ color: 'var(--text-primary)' }}>{c.cliente_nombre}</td>
                    <td>#{c.prestamo_id}</td>
                    <td>#{c.numero_cuota}</td>
                    <td className="text-mono">{formatMoney(c.monto)}</td>
                    <td>
                      <span className={`badge ${c.dias_atraso > 30 ? 'badge-danger' : 'badge-warning'}`}>
                        {c.dias_atraso} días
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
