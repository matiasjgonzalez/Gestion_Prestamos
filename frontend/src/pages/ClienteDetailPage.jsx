import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCliente, getPrestamos, getClienteResumen, downloadEstadoCuenta, getArchivos, subirArchivo, eliminarArchivo, downloadArchivo } from '../services/api';
import { ArrowLeft, Banknote, AlertTriangle, Phone, MapPin, Download, Briefcase, FileText, Upload, Trash2, FileCheck } from 'lucide-react';
import { formatMoney } from '../utils/helpers';
import { SkeletonCards, SkeletonTable } from '../components/Skeleton';
import toast from 'react-hot-toast';

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
  const [archivos, setArchivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [subiendo, setSubiendo] = useState({});
  const [descargando, setDescargando] = useState({});
  const fileInputRefs = { pagare: useRef(), recibo_sueldo: useRef() };

  useEffect(() => { loadData(); }, [id]);

  const loadData = async () => {
    try {
      const [cRes, pRes, rRes, aRes] = await Promise.allSettled([
        getCliente(id),
        getPrestamos({ cliente_id: parseInt(id), limit: 100, offset: 0 }),
        getClienteResumen(id),
        getArchivos(id),
      ]);
      if (cRes.status === 'rejected') { navigate('/clientes'); return; }
      setCliente(cRes.value.data);
      if (pRes.status === 'fulfilled') setPrestamos(pRes.value.data);
      if (rRes.status === 'fulfilled') setResumen(rRes.value.data);
      if (aRes.status === 'fulfilled') setArchivos(aRes.value.data);
    } finally {
      setLoading(false);
    }
  };

  const handleSubirArchivo = async (tipo, file) => {
    if (!file) return;
    setSubiendo((s) => ({ ...s, [tipo]: true }));
    try {
      await subirArchivo(id, tipo, file);
      toast.success('Archivo subido correctamente');
      const res = await getArchivos(id);
      setArchivos(res.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al subir archivo');
    } finally {
      setSubiendo((s) => ({ ...s, [tipo]: false }));
      if (fileInputRefs[tipo]?.current) fileInputRefs[tipo].current.value = '';
    }
  };

  const handleEliminarArchivo = async (tipo) => {
    if (!window.confirm('¿Eliminar este archivo? No se puede deshacer.')) return;
    try {
      await eliminarArchivo(id, tipo);
      toast.success('Archivo eliminado');
      setArchivos((prev) => prev.filter((a) => a.tipo !== tipo));
    } catch {
      toast.error('Error al eliminar archivo');
    }
  };

  const handleDescargarArchivo = async (tipo, nombreArchivo) => {
    setDescargando((d) => ({ ...d, [tipo]: true }));
    try {
      await downloadArchivo(id, tipo, nombreArchivo);
    } catch {
      toast.error('Error al descargar archivo');
    } finally {
      setDescargando((d) => ({ ...d, [tipo]: false }));
    }
  };

  const archivosPorTipo = archivos.reduce((acc, a) => { acc[a.tipo] = a; return acc; }, {});

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
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {resumen?.tiene_mora && (
            <span className="badge badge-danger" style={{ fontSize: '0.85rem', padding: '6px 12px' }}>
              <AlertTriangle size={13} style={{ marginRight: 4, verticalAlign: -1 }} />
              En mora
            </span>
          )}
          <button
            className="btn btn-secondary btn-sm"
            disabled={exporting}
            onClick={async () => {
              setExporting(true);
              try { await downloadEstadoCuenta(id, `${cliente.apellido}_${cliente.nombre}`); }
              catch { }
              finally { setExporting(false); }
            }}
          >
            <Download size={14} />
            {exporting ? 'Exportando...' : 'Estado de Cuenta'}
          </button>
        </div>
      </div>

      {/* Info del cliente */}
      <div className="card mb-16">
        <div className="detail-grid">
          <div className="detail-item">
            <label>DNI</label>
            <span className="text-mono">{cliente.dni}</span>
          </div>
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
            <label>Empleo / Ocupación</label>
            <span>
              {cliente.empleo
                ? <><Briefcase size={13} style={{ marginRight: 4, verticalAlign: -1 }} />{cliente.empleo}</>
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

      {/* Documentos */}
      <h3 style={{ marginBottom: 12, fontSize: '1.05rem' }}>
        <FileText size={16} style={{ marginRight: 6, verticalAlign: -2 }} />
        Documentos
      </h3>
      <div className="card-grid" style={{ marginBottom: 24 }}>
        {[
          { tipo: 'pagare', label: 'Pagaré' },
          { tipo: 'recibo_sueldo', label: 'Recibo de Sueldo' },
        ].map(({ tipo, label }) => {
          const archivo = archivosPorTipo[tipo];
          return (
            <div key={tipo} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Título */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {archivo
                  ? <FileCheck size={18} style={{ color: 'var(--success)', flexShrink: 0 }} />
                  : <FileText size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{label}</span>
              </div>

              {/* Info archivo */}
              {archivo ? (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  <div style={{ wordBreak: 'break-all' }}>{archivo.nombre_archivo}</div>
                  <div>Subido: {new Date(archivo.fecha_subida).toLocaleDateString('es-AR')}</div>
                </div>
              ) : (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Sin archivo cargado</div>
              )}

              {/* Input oculto */}
              <input
                ref={fileInputRefs[tipo]}
                type="file"
                accept="application/pdf"
                style={{ display: 'none' }}
                onChange={(e) => handleSubirArchivo(tipo, e.target.files[0])}
              />

              {/* Botones */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                {archivo ? (
                  <>
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={descargando[tipo]}
                      onClick={() => handleDescargarArchivo(tipo, archivo.nombre_archivo)}
                    >
                      <Download size={13} />
                      {descargando[tipo] ? 'Descargando...' : 'Descargar'}
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={subiendo[tipo]}
                      onClick={() => fileInputRefs[tipo].current?.click()}
                    >
                      <Upload size={13} />
                      {subiendo[tipo] ? 'Subiendo...' : 'Reemplazar'}
                    </button>
                    <button
                      className="btn btn-sm"
                      style={{ color: 'var(--danger)', background: 'transparent', border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', padding: '5px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.8rem' }}
                      onClick={() => handleEliminarArchivo(tipo)}
                    >
                      <Trash2 size={13} />
                      Eliminar
                    </button>
                  </>
                ) : (
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={subiendo[tipo]}
                    onClick={() => fileInputRefs[tipo].current?.click()}
                  >
                    <Upload size={13} />
                    {subiendo[tipo] ? 'Subiendo...' : 'Subir PDF'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

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
