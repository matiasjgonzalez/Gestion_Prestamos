import { useState, useEffect } from 'react';
import { getDashboard } from '../services/api';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign, TrendingUp, AlertTriangle, Banknote, Users,
} from 'lucide-react';
import { formatMoney } from '../utils/helpers';
import { SkeletonCards, SkeletonTable } from '../components/Skeleton';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

const COLORS_COBRADO = ['#16A34A', '#0284C7'];
const COLORS_ESTADO  = ['#16A34A', '#D97706', '#E11D48'];
const COLORS_TIPO    = ['#0284C7', '#7C3AED', '#D97706'];

const ESTADO_LABEL = { pagada: 'Pagadas', pendiente: 'Pendientes', vencida: 'Vencidas' };
const TIPO_LABEL   = { semanal: 'Semanal', quincenal: 'Quincenal', mensual: 'Mensual' };

function CustomTooltipMoney({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <span className="chart-tooltip-label">{payload[0].name}</span>
      <span className="chart-tooltip-value">{formatMoney(payload[0].value)}</span>
    </div>
  );
}

function CustomTooltipCount({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <span className="chart-tooltip-label">{payload[0].name ?? payload[0].payload?.tipo ?? payload[0].payload?.estado}</span>
      <span className="chart-tooltip-value">{payload[0].value} préstamos</span>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const res = await getDashboard();
      setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div>
      <div className="page-header"><h2>Dashboard</h2></div>
      <SkeletonCards count={5} />
      <SkeletonTable rows={3} cols={5} />
    </div>
  );
  if (!data) return null;

  const moraData = data.mora;

  const stats = [
    { label: 'Total Prestado',       value: formatMoney(data.total_prestado),  icon: DollarSign,   colorClass: '' },
    { label: 'Total Cobrado',        value: formatMoney(data.total_cobrado),   icon: TrendingUp,   colorClass: 'success' },
    { label: 'Deuda Total',          value: formatMoney(data.deuda_total),     icon: Banknote,     colorClass: 'accent' },
    { label: 'Préstamos Activos',    value: data.prestamos_activos,            icon: Banknote,     colorClass: '' },
    { label: 'Clientes c/ Préstamos',value: data.clientes_con_prestamos,       icon: Users,        colorClass: '' },
  ];

  // Donut cobrado vs pendiente
  const cobradoData = [
    { name: 'Cobrado',   value: data.total_cobrado },
    { name: 'Pendiente', value: Math.max(0, data.deuda_total) },
  ];

  // Donut cuotas por estado
  const estadosData = (data.cuotas_por_estado || []).map((r) => ({
    name: ESTADO_LABEL[r.estado] ?? r.estado,
    value: r.cantidad,
  }));

  // Barras préstamos por tipo
  const tiposData = (data.prestamos_por_tipo || []).map((r) => ({
    tipo: TIPO_LABEL[r.tipo] ?? r.tipo,
    cantidad: r.cantidad,
  }));

  return (
    <div>
      <div className="page-header"><h2>Dashboard</h2></div>

      {/* Stat cards */}
      <div className="card-grid">
        {stats.map((s, i) => (
          <div className="stat-card" key={i}>
            <div className="stat-label">{s.label}</div>
            <div className={`stat-value ${s.colorClass}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="charts-grid">

        {/* Donut cobrado vs pendiente */}
        <div className="chart-card">
          <div className="chart-title">Cobrado vs Pendiente</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={cobradoData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={3}
                dataKey="value"
              >
                {cobradoData.map((_, i) => (
                  <Cell key={i} fill={COLORS_COBRADO[i]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltipMoney />} />
              <Legend iconType="circle" iconSize={10} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Donut cuotas por estado */}
        <div className="chart-card">
          <div className="chart-title">Cuotas por Estado</div>
          {estadosData.length === 0 ? (
            <div className="chart-empty">Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={estadosData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {estadosData.map((entry, i) => {
                    const colorMap = { Pagadas: '#16A34A', Pendientes: '#D97706', Vencidas: '#E11D48' };
                    return <Cell key={i} fill={colorMap[entry.name] ?? COLORS_ESTADO[i % 3]} />;
                  })}
                </Pie>
                <Tooltip formatter={(value) => [`${value} cuotas`, '']} />
                <Legend iconType="circle" iconSize={10} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Barras préstamos por tipo */}
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
                  {tiposData.map((_, i) => (
                    <Cell key={i} fill={COLORS_TIPO[i % 3]} />
                  ))}
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
