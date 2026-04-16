import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login } from '../services/api';
import { LogIn, Loader2, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const { saveToken } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || ''}/ping`).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      const res = await login(username, password);
      saveToken(res.data.access_token, res.data.must_change_password, res.data.is_admin);
      navigate(res.data.must_change_password ? '/cambiar-password' : '/');
    } catch (err) {
      const status = err.response?.status;
      const msg = status === 401 || status === 400
        ? 'Usuario o contraseña incorrectos.'
        : 'Error de conexión. Intentá de nuevo.';
      setError(msg);
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (setter) => (e) => {
    setter(e.target.value);
    if (error) setError('');
  };

  return (
    <div className="login-container">
      <div className={`login-box${shake ? ' login-shake' : ''}`}>
        <h1><span className="text-accent">$</span> Préstamos</h1>
        <p>Ingresá tus credenciales para acceder</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Usuario</label>
            <input
              className={`form-control${error ? ' input-error' : ''}`}
              type="text"
              value={username}
              onChange={handleChange(setUsername)}
              placeholder="admin"
              autoFocus
              required
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label>Contraseña</label>
            <input
              className={`form-control${error ? ' input-error' : ''}`}
              type="password"
              value={password}
              onChange={handleChange(setPassword)}
              placeholder="••••••"
              required
              disabled={loading}
            />
          </div>

          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--danger-muted)',
              border: '1px solid var(--danger)',
              borderRadius: 'var(--radius-sm)',
              padding: '9px 12px',
              marginBottom: 12,
              fontSize: '0.84rem',
              color: 'var(--danger)',
            }}>
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} />
                Ingresando...
              </>
            ) : (
              <>
                <LogIn size={16} />
                Ingresar
              </>
            )}
          </button>
        </form>

        {loading && (
          <p style={{
            textAlign: 'center',
            marginTop: 14,
            fontSize: '0.78rem',
            color: 'var(--text-muted)',
          }}>
            Conectando con el servidor...
          </p>
        )}
      </div>
    </div>
  );
}
