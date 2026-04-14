import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { verificarMora, getMora, downloadExcel, invalidateCache } from '../services/api';
import toast from 'react-hot-toast';
import { AlertTriangle, RefreshCw, Download, Search, X } from 'lucide-react';
import { formatMoney, useDebounce } from '../utils/helpers';
import { SkeletonTable } from '../components/Skeleton';

const PAGE_SIZE = 10;

export default function MoraPage() {
  const [cuotas, setCuotas] = useState([]);
  const [totalMora, setTotalMora] = useState(0);
  const [totalMontoMora, setTotalMontoMora] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const debouncedSearch = useDebounce(search, 300);
  const navigate = useNavigate();

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  useEffect(() => {
    loadMora();
  }, [page, debouncedSearch]);

  const loadMora = async () => {
    setLoading(true);
    try {
      const res = await getMora({
        search: debouncedSearch,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setCuotas(res.data.cuotas);
      setTotalMora(res.data.total_en_mora);
      setTotalMontoMora(res.data.total_monto_mora ?? 0);
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
      invalidateCache('/mora');
      loadMora();
    } catch {
      toast.error('Error al verificar mora');
    } finally {
      setRefreshing(false);
    }
  };

  const totalPages = Math.ceil(totalMora / PAGE_SIZE);

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
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-secondary"
            onClick={() => downloadExcel('/mora/export/xlsx', 'mora.xlsx')}
          >
            <Download size={16} />Exportar Excel
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw size={16} className={refreshing ? 'spinning' : ''} />
            {refreshing ? 'Verificando...' : 'Verificar Mora'}
          </button>
        </div>
      </div>

      {totalMora > 0 && (
        <div className="card-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-label">Cuotas en Mora</div>
            <div className="stat-value danger">{totalMora}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Monto Total en Mora</div>
            <div className="stat-value danger">{formatMoney(totalMontoMora)}</div>
          </div>
        </div>
      )}

      {/* Buscador */}
      <div className="filter-bar">
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="form-control"
            style={{ paddingLeft: 32 }}
            placeholder="Buscar por cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {search && (
          <button className="btn btn-secondary btn-sm" onClick={() => setSearch('')}>
            <X size={14} /> Limpiar
          </button>
        )}
      </div>

      {loading ? (
        <SkeletonTable rows={PAGE_SIZE} cols={7} />
      ) : cuotas.length === 0 ? (
        <div className="empty-state">
          <AlertTriangle size={40} />
          <h3>Sin cuotas en mora</h3>
          <p>{search ? 'No hay resultados para esa búsqueda' : 'No hay cuotas vencidas actualmente'}</p>
        </div>
      ) : (
        <>
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
                {cuotas.map((c) => (
                  <tr key={c.cuota_id}>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                      {c.cliente_nombre}
                    </td>
                    <td className="text-mono">#{c.prestamo_id}</td>
                    <td className="text-mono">#{c.numero_cuota}</td>
                    <td>
                      {new Date(c.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-AR')}
                    </td>
                    <td className="text-mono">{formatMoney(c.monto)}</td>
                    <td>
                      <span className={`badge ${c.dias_atraso > 30 ? 'badge-danger' : 'badge-warning'}`}>
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

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                Anterior
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages - 1}
              >
                Siguiente
              </button>
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              Página {page + 1} de {totalPages} · {totalMora} cuota{totalMora !== 1 ? 's' : ''}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
