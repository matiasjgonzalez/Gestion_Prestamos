import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCliente, getPrestamos } from '../services/api';
import { ArrowLeft, Banknote } from 'lucide-react';

function formatMoney(n) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}

function estadoBadge(estado) {
  if (estado === 'activo') return <span className="badge badge-default">Activo</span>;
  return <span className="badge badge-success">Finalizado</span>;
}

export default function ClienteDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cliente, setCliente] = useState(null);
  const [prestamos, setPrestamos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [id]);

  const loadData = async () => {
    try {
      const [cRes, pRes] = await Promise.all([getCliente(id), getPrestamos()]);
      setCliente(cRes.data);
      setPrestamos(pRes.data.filter((p) => p.cliente_id === parseInt(id)));
    } catch { navigate('/clientes'); }
    finally { setLoading(false); }
  };

  if (loading) return <div className="empty-state"><p>Cargando...</p></div>;
  if (!cliente) return null;

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn-icon" onClick={() => navigate('/clientes')}><ArrowLeft size={18} /></button>
          <h2>{cliente.nombre} {cliente.apellido}</h2>
        </div>
      </div>
      <div className="card mb-16">
        <div className="detail-grid">
          <div className="detail-item"><label>DNI</label><span className="text-mono">{cliente.dni}</span></div>
          <div className="detail-item"><label>Teléfono</label><span>{cliente.telefono || '—'}</span></div>
          <div className="detail-item"><label>Domicilio</label><span>{cliente.domicilio || '—'}</span></div>
          <div className="detail-item"><label>Fecha creación</label>
            <span>{cliente.fecha_creacion ? new Date(cliente.fecha_creacion).toLocaleDateString('es-AR') : '—'}</span>
          </div>
        </div>
      </div>
      <h3 style={{ marginBottom: 16, fontSize: '1.1rem' }}>Préstamos ({prestamos.length})</h3>
      {prestamos.length === 0 ? (
        <div className="empty-state"><Banknote size={36} /><h3>Sin préstamos</h3><p>Este cliente no tiene préstamos registrados</p></div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead><tr><th>ID</th><th>Monto</th><th>Interés</th><th>Cuotas</th><th>Fecha Inicio</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {prestamos.map((p) => (
                <tr key={p.id}>
                  <td className="text-mono">#{p.id}</td>
                  <td className="text-mono">{formatMoney(p.monto)}</td>
                  <td>{p.interes_total}%</td>
                  <td>{p.cuotas}</td>
                  <td>{p.fecha_inicio || '—'}</td>
                  <td>{estadoBadge(p.estado)}</td>
                  <td><button className="btn btn-secondary btn-sm" onClick={() => navigate(`/prestamos/${p.id}`)}>Ver detalle</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
