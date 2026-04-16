import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getClientes, getPrestamos } from '../services/api';
import { useDebounce } from '../utils/helpers';
import { Search, Users, Banknote, X } from 'lucide-react';

export default function GlobalSearch({ onClose }) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const [clientes, setClientes] = useState([]);
  const [prestamos, setPrestamos] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setClientes([]);
      setPrestamos([]);
      return;
    }
    setLoading(true);
    Promise.allSettled([
      getClientes(debouncedQuery, { limit: 5, offset: 0 }),
      getPrestamos({ search: debouncedQuery, limit: 5, offset: 0 }),
    ]).then(([cRes, pRes]) => {
      setClientes(cRes.status === 'fulfilled' ? cRes.value.data : []);
      setPrestamos(pRes.status === 'fulfilled' ? pRes.value.data : []);
    }).finally(() => setLoading(false));
  }, [debouncedQuery]);

  const goTo = (path) => { navigate(path); onClose(); };

  const hasResults = clientes.length > 0 || prestamos.length > 0;

  return (
    <div className="gsearch-overlay" onClick={onClose}>
      <div className="gsearch-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gsearch-input-row">
          <Search size={17} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            className="gsearch-input"
            placeholder="Buscar clientes, préstamos..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && onClose()}
          />
          <button className="btn-icon" onClick={onClose}><X size={17} /></button>
        </div>

        {loading && <div className="gsearch-status">Buscando...</div>}

        {!loading && debouncedQuery && !hasResults && (
          <div className="gsearch-status">Sin resultados para "{debouncedQuery}"</div>
        )}

        {!loading && hasResults && (
          <div className="gsearch-results">
            {clientes.length > 0 && (
              <div className="gsearch-section">
                <div className="gsearch-section-title">
                  <Users size={12} /> Clientes
                </div>
                {clientes.map((c) => (
                  <button key={c.id} className="gsearch-item" onClick={() => goTo(`/clientes/${c.id}`)}>
                    <span className="gsearch-item-name">{c.nombre} {c.apellido}</span>
                    <span className="gsearch-item-meta">DNI {c.dni}</span>
                  </button>
                ))}
              </div>
            )}
            {prestamos.length > 0 && (
              <div className="gsearch-section">
                <div className="gsearch-section-title">
                  <Banknote size={12} /> Préstamos
                </div>
                {prestamos.map((p) => (
                  <button key={p.id} className="gsearch-item" onClick={() => goTo(`/prestamos/${p.id}`)}>
                    <span className="gsearch-item-name">#{p.id} — {p.cliente_nombre || 'Sin cliente'}</span>
                    <span className="gsearch-item-meta">{p.estado} · ${Number(p.monto).toLocaleString('es-AR')}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {!debouncedQuery && (
          <div className="gsearch-status">Escribí para buscar clientes o préstamos</div>
        )}
      </div>
    </div>
  );
}
