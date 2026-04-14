import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { changePassword } from '../services/api';
import toast from 'react-hot-toast';
import { KeyRound } from 'lucide-react';

export default function ChangePasswordPage() {
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const { clearMustChange } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (newPassword !== confirm) {
      toast.error('Las contraseñas no coinciden');
      return;
    }
    setLoading(true);
    try {
      await changePassword(newPassword);
      clearMustChange();
      toast.success('Contraseña actualizada');
      navigate('/');
    } catch (err) {
      toast.error(err.userMessage || 'Error al cambiar contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1><KeyRound size={22} style={{ marginRight: 8, verticalAlign: -3 }} />Cambiar contraseña</h1>
        <p>Debés establecer una nueva contraseña para continuar</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nueva contraseña</label>
            <input
              className="form-control"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              autoFocus
              required
            />
          </div>
          <div className="form-group">
            <label>Confirmar contraseña</label>
            <input
              className="form-control"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repetí la contraseña"
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
            disabled={loading}
          >
            <KeyRound size={16} />
            {loading ? 'Guardando...' : 'Guardar contraseña'}
          </button>
        </form>
      </div>
    </div>
  );
}
