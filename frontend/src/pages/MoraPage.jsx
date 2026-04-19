import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { verificarMora, getMoraClientes, downloadMoraZip, invalidateCache } from '../services/api';
import toast from 'react-hot-toast';
import { AlertTriangle, RefreshCw, Download, Search, X, ArrowUpAZ, ArrowDownAZ } from 'lucide-react';
import { formatMoney, useDebounce } from '../utils/helpers';
import { SkeletonTable } from '../components/Skeleton';

const PAGE_SIZE = 10;

export default function MoraPage() {
  const [clientes, setClientes] = useState([]);
  const [totalClientes, setTotalClientes] = useState(0);
  const [totalMontoMora, setTotalMontoMora] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [sortDesc, setSortDesc] = useState(false);
  const debouncedSearch = useDebounce(search, 300);
  const navigate = useNavigate();

  useEffect(() => { setPage(0); }, [debouncedSearch, sortDesc]);
  useEffect(() => { loadMora(); }, [page, debouncedSearch, sortDesc]);

  const loadMora = async () => {
    setLoading(true);
    try {
      const res = await getMoraClientes({
        search: debouncedSearch,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        sort_desc: sortDesc,
      });
      setClientes(res.data.clientes);
      setTotalClientes(res.data.total_clientes);
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

  const totalPages = Math.ceil(totalClientes / PAGE_SIZE);

  return (
    <div>
      <div className="page-header">
        <h2>
          <AlertTriangle size={22} style={{ marginRight: 8, verticalAlign: -3, color: 'var(--danger)' }} />
          Mora
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => downloadMoraZip()}>
            <Download size={16} />Exportar ZIP
          </button>
          <button className="btn btn-secondary" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? 'spinning' : ''} />
            {refreshing ? 'Verificando...' : 'Verificar Mora'}
          </button>
        </div>
      </div>

      {totalClientes > 0 && (
        <div className="card-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-label">Clientes en Mora</div>
            <div className="stat-value danger">{totalClientes}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Monto Total en Mora</div>
            <div className="stat-value danger">{formatMoney(totalMontoMora)}</div>
          </div>
        </div>
      )}

      <div className="filter-bar">
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="form-control"
            style={{ paddingLeft: 32 }}
            placeholder="Buscar por cliente o DNI..."
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
        <SkeletonTable rows={PAGE_SIZE} cols={5} />
      ) : clientes.length === 0 ? (
        <div className="empty-state">
          <AlertTriangle size={40} />
          <h3>Sin clientes en mora</h3>
          <p>{search ? 'No hay resultados para esa búsqueda' : 'No hay clientes con cuotas vencidas'}</p>
        </div>
      ) : (
        <>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                      onClick={() => { setSortDesc(d => !d); setPage(0); }}>
                    Apellido
                    {sortDesc
                      ? <ArrowDownAZ size={13} style={{ marginLeft: 4, verticalAlign: -1 }} />
                      : <ArrowUpAZ size={13} style={{ marginLeft: 4, verticalAlign: -1 }} />}
                  </th>
                  <th>Nombre</th>
                  <th>DNI</th>
                  <th>Cuotas vencidas</th>
                  <th>Monto total</th>
                  <th>Días en mora</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((c) => (
                  <tr key={c.cliente_id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/clientes/${c.cliente_id}`)}>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{c.cliente_apellido}</td>
                    <td style={{ color: 'var(--text-primary)' }}>{c.cliente_nombre}</td>
                    <td className="text-mono">{c.cliente_dni}</td>
                    <td>
                      <span className="badge badge-danger">{c.cuotas_en_mora} cuota{c.cuotas_en_mora !== 1 ? 's' : ''}</span>
                    </td>
                    <td className="text-mono">{formatMoney(c.monto_total)}</td>
                    <td>
                      <span className={`badge ${c.dias_atraso > 30 ? 'badge-danger' : 'badge-warning'}`}>
                        {c.dias_atraso} días
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => navigate(`/clientes/${c.cliente_id}`)}
                      >
                        Ver cliente
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
                Anterior
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages - 1}>
                Siguiente
              </button>
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              Página {page + 1} de {Math.max(1, totalPages)} · {totalClientes} cliente{totalClientes !== 1 ? 's' : ''}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
