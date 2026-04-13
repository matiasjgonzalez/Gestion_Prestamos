import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { verificarMora, getMora } from '../services/api';
import toast from 'react-hot-toast';
import { AlertTriangle, RefreshCw } from 'lucide-react';

function formatMoney(n) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export default function MoraPage() {
  const [cuotas, setCuotas] = useState([]);
  const [totalMora, setTotalMora] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadMora();
  }, []);

  const loadMora = async () => {
    try {
      // No ejecutar la verificación automática en el montaje (costosa).
      // Solo obtener los datos ya calculados en el servidor.
      const res = await getMora();
      setCuotas(res.data.cuotas);
      setTotalMora(res.data.total_en_mora);
    } catch {
      toast.error('Error al cargar mora');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const vRes = await verificarMora();
      const nuevas = vRes.data.nuevas_cuotas_vencidas;
      if (nuevas > 0) {
        toast.success(`${nuevas} cuota(s) nueva(s) marcada(s) como vencida(s)`);
      } else {
        toast('Sin nuevas cuotas vencidas', { icon: 'ℹ️' });
      }
      const res = await getMora();
      setCuotas(res.data.cuotas);
      setTotalMora(res.data.total_en_mora);
    } catch {
      toast.error('Error al verificar mora');
    } finally {
      setRefreshing(false);
    }
  };

  const montoTotalMora = cuotas.reduce((s, c) => s + c.monto, 0);

  if (loading) return <div className="empty-state"><p>Cargando...</p></div>;

  return (
    <div>
      <div className="page-header">
        <h2>
          <AlertTriangle
            size={22}
            style={{ marginRight: 8, verticalAlign: -3, color: 'var(--danger)' }}
          />
          Mora
        </h2>
        <button
          className="btn btn-secondary"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw size={16} className={refreshing ? 'spinning' : ''} />
          {refreshing ? 'Verificando...' : 'Verificar Mora'}
        </button>
      </div>

      {totalMora > 0 && (
        <div className="card-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-label">Cuotas en Mora</div>
            <div className="stat-value danger">{totalMora}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Monto Total en Mora</div>
            <div className="stat-value danger">{formatMoney(montoTotalMora)}</div>
          </div>
        </div>
      )}

      {cuotas.length === 0 ? (
        <div className="empty-state">
          <AlertTriangle size={40} />
          <h3>Sin cuotas en mora</h3>
          <p>No hay cuotas vencidas actualmente</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Préstamo</th>
                <th>Cuota #</th>
                <th>Vencimiento</th>
                <th>Monto</th>
                <th>Días Atraso</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cuotas
                .sort((a, b) => b.dias_atraso - a.dias_atraso)
                .map((c) => (
                  <tr key={c.cuota_id}>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                      {c.cliente_nombre} {c.cliente_apellido}
                    </td>
                    <td className="text-mono">#{c.prestamo_id}</td>
                    <td className="text-mono">#{c.numero_cuota}</td>
                    <td>
                      {new Date(c.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-AR')}
                    </td>
                    <td className="text-mono">{formatMoney(c.monto)}</td>
                    <td>
                      <span
                        className={`badge ${
                          c.dias_atraso > 30
                            ? 'badge-danger'
                            : 'badge-warning'
                        }`}
                      >
                        {c.dias_atraso} días
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => navigate(`/prestamos/${c.prestamo_id}`)}
                      >
                        Ver préstamo
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
