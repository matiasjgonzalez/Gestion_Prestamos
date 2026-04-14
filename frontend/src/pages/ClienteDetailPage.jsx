import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCliente, getPrestamos, getClienteResumen } from '../services/api';
import { ArrowLeft, Banknote, AlertTriangle, Phone, MapPin } from 'lucide-react';
import { formatMoney } from '../utils/helpers';
import { SkeletonCards, SkeletonTable } from '../components/Skeleton';

function estadoBadge(estado) {
  if (estado === 'activo') return <span className="badge badge-default">Activo</span>;
  return <span className="badge badge-success">Finalizado</span>;
}

export default function ClienteDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cliente, setCliente] = useState(null);
  const [prestamos, setPrestamos] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [id]);

  const loadData = async () => {
    try {
      const [cRes, pRes, rRes] = await Promise.allSettled([
        getCliente(id),
        getPrestamos({ cliente_id: parseInt(id), limit: 100, offset: 0 }),
        getClienteResumen(id),
      ]);
      if (cRes.status === 'rejected') { navigate('/clientes'); return; }
      setCliente(cRes.value.data);
      if (pRes.status === 'fulfilled') setPrestamos(pRes.value.data);
      if (rRes.status === 'fulfilled') setResumen(rRes.value.data);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div>
      <SkeletonCards count={4} />
      <SkeletonTable rows={4} cols={6} />
    </div>
  );
  if (!cliente) return null;

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn-icon" onClick={() => navigate('/clientes')}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2>{cliente.nombre} {cliente.apellido}</h2>
            <span className="text-sm text-muted">DNI {cliente.dni}</span>
          </div>
        </div>
        {resumen?.tiene_mora && (
          <span className="badge badge-danger" style={{ fontSize: '0.85rem', padding: '6px 12px' }}>
            <AlertTriangle size={13} style={{ marginRight: 4, verticalAlign: -1 }} />
            En mora
          </span>
        )}
      </div>

      {/* Info del cliente */}
      <div className="card mb-16">
        <div className="detail-grid">
          <div className="detail-item">
            <label>Teléfono</label>
            <span>
              {cliente.telefono
                ? <a href={`tel:${cliente.telefono}`} style={{ color: 'var(--accent)' }}>
                    <Phone size={13} style={{ marginRight: 4, verticalAlign: -1 }} />
                    {cliente.telefono}
                  </a>
                : '—'}
            </span>
          </div>
          <div className="detail-item">
            <label>Domicilio</label>
            <span>
              {cliente.domicilio
                ? <><MapPin size={13} style={{ marginRight: 4, verticalAlign: -1 }} />{cliente.domicilio}</>
                : '—'}
            </span>
          </div>
          <div className="detail-item">
            <label>Cliente desde</label>
            <span>{cliente.fecha_creacion ? new Date(cliente.fecha_creacion).toLocaleDateString('es-AR') : '—'}</span>
          </div>
        </div>
      </div>

      {/* Stats del cliente */}
      {resumen && (
        <div className="card-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-label">Préstamos Totales</div>
            <div className="stat-value">{resumen.prestamos_total}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Préstamos Activos</div>
            <div className="stat-value accent">{resumen.prestamos_activos}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Deuda Total</div>
            <div className={`stat-value ${resumen.deuda_total > 0 ? 'danger' : 'success'}`}>
              {formatMoney(resumen.deuda_total)}
            </div>
          </div>
          {resumen.tiene_mora && (
            <div className="stat-card">
              <div className="stat-label">Monto en Mora</div>
              <div className="stat-value danger">{formatMoney(resumen.monto_mora)}</div>
            </div>
          )}
        </div>
      )}

      {/* Préstamos */}
      <h3 style={{ marginBottom: 12, fontSize: '1.05rem' }}>
        <Banknote size={16} style={{ marginRight: 6, verticalAlign: -2 }} />
        Préstamos ({prestamos.length})
      </h3>
      {prestamos.length === 0 ? (
        <div className="empty-state">
          <Banknote size={36} />
          <h3>Sin préstamos</h3>
          <p>Este cliente no tiene préstamos registrados</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Tipo</th>
                <th>Monto</th>
                <th>Interés</th>
                <th>Cuotas</th>
                <th>Fecha Inicio</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {prestamos.map((p) => (
                <tr key={p.id}>
                  <td className="text-mono">#{p.id}</td>
                  <td style={{ textTransform: 'capitalize' }}>{p.tipo_prestamo || 'mensual'}</td>
                  <td className="text-mono">{formatMoney(p.monto)}</td>
                  <td>{p.interes_total}%</td>
                  <td>{p.cuotas}</td>
                  <td>{p.fecha_inicio || '—'}</td>
                  <td>{estadoBadge(p.estado)}</td>
                  <td>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => navigate(`/prestamos/${p.id}`)}
                    >
                      Ver detalle
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
