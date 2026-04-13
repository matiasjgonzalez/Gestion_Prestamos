import { useState, useEffect } from 'react';
import { getDashboard } from '../services/api';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Banknote,
  Users,
} from 'lucide-react';

function formatMoney(n) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // 1 sola request: dashboard + verificar mora + cuotas en mora
      const res = await getDashboard();
      setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="empty-state">
        <p>Cargando...</p>
      </div>
    );
  }

  if (!data) return null;

  const moraData = data.mora;

  const stats = [
    {
      label: 'Total Prestado',
      value: formatMoney(data.total_prestado),
      icon: DollarSign,
      colorClass: '',
    },
    {
      label: 'Total Cobrado',
      value: formatMoney(data.total_cobrado),
      icon: TrendingUp,
      colorClass: 'success',
    },
    {
      label: 'Deuda Total',
      value: formatMoney(data.deuda_total),
      icon: Banknote,
      colorClass: 'accent',
    },
    {
      label: 'Préstamos Activos',
      value: data.prestamos_activos,
      icon: Banknote,
      colorClass: '',
    },
    {
      label: 'Clientes c/ Préstamos',
      value: data.clientes_con_prestamos,
      icon: Users,
      colorClass: '',
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h2>Dashboard</h2>
      </div>

      <div className="card-grid">
        {stats.map((s, i) => (
          <div className="stat-card" key={i}>
            <div className="stat-label">{s.label}</div>
            <div className={`stat-value ${s.colorClass}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {moraData && moraData.total_en_mora > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="flex-between mb-16">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={18} className="text-danger" />
              Cuotas en Mora ({moraData.total_en_mora})
            </h3>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => navigate('/mora')}
            >
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
                    <td style={{ color: 'var(--text-primary)' }}>
                      {c.cliente_nombre} {c.cliente_apellido}
                    </td>
                    <td>#{c.prestamo_id}</td>
                    <td>#{c.numero_cuota}</td>
                    <td className="text-mono">{formatMoney(c.monto)}</td>
                    <td>
                      <span className="badge badge-danger">
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
