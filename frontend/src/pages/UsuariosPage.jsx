import { useState, useEffect } from 'react';
import { getUsuarios, createUsuario, resetPasswordUsuario, toggleActiveUsuario, toggleRoleUsuario } from '../services/api';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import { UserPlus, RefreshCw, UserCheck, UserX, ShieldCheck, ShieldOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const { token } = useAuth();

  // Modal crear usuario
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ username: '', password: '', is_admin: false });
  const [creating, setCreating] = useState(false);

  // Modal resetear contraseña
  const [resetModal, setResetModal] = useState(null); // { id, username }
  const [tempPassword, setTempPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  useEffect(() => { loadUsuarios(); }, []);

  const loadUsuarios = async () => {
    try {
      const res = await getUsuarios();
      setUsuarios(res.data);
    } catch {
      toast.error('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (createForm.password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setCreating(true);
    try {
      await createUsuario(createForm);
      toast.success('Usuario creado');
      setShowCreate(false);
      setCreateForm({ username: '', password: '', is_admin: false });
      loadUsuarios();
    } catch (err) {
      toast.error(err.userMessage || 'Error al crear usuario');
    } finally {
      setCreating(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (tempPassword.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setResetting(true);
    try {
      await resetPasswordUsuario(resetModal.id, tempPassword);
      toast.success(`Contraseña de "${resetModal.username}" restablecida`);
      setResetModal(null);
      setTempPassword('');
    } catch (err) {
      toast.error(err.userMessage || 'Error al restablecer contraseña');
    } finally {
      setResetting(false);
    }
  };

  const handleToggle = async (u) => {
    try {
      await toggleActiveUsuario(u.id);
      toast.success(u.is_active ? `"${u.username}" desactivado` : `"${u.username}" activado`);
      loadUsuarios();
    } catch (err) {
      toast.error(err.userMessage || 'Error');
    }
  };

  const handleToggleRole = async (u) => {
    const nuevoRol = u.is_admin ? 'usuario' : 'admin';
    if (!window.confirm(`¿Cambiar el rol de "${u.username}" a ${nuevoRol}?`)) return;
    try {
      await toggleRoleUsuario(u.id);
      toast.success(`Rol de "${u.username}" cambiado a ${nuevoRol}`);
      loadUsuarios();
    } catch (err) {
      toast.error(err.userMessage || 'Error');
    }
  };

  if (loading) return <div style={{ padding: 32, color: 'var(--text-muted)' }}>Cargando...</div>;

  return (
    <div>
      <div className="page-header">
        <h2>
          <ShieldCheck size={20} style={{ marginRight: 8, verticalAlign: -2 }} />
          Usuarios
        </h2>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <UserPlus size={16} />Nuevo usuario
        </button>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Primer login</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{u.username}</td>
                <td>
                  {u.is_admin
                    ? <span className="badge badge-warning">Admin</span>
                    : <span className="badge badge-default">Usuario</span>}
                </td>
                <td>
                  {u.is_active
                    ? <span className="badge badge-success">Activo</span>
                    : <span className="badge badge-danger">Inactivo</span>}
                </td>
                <td>
                  {u.must_change_password
                    ? <span className="badge badge-warning">Pendiente</span>
                    : <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => { setResetModal({ id: u.id, username: u.username }); setTempPassword(''); }}
                    >
                      <RefreshCw size={13} />Resetear pass
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      title={u.is_admin ? 'Quitar admin' : 'Hacer admin'}
                      onClick={() => handleToggleRole(u)}
                    >
                      {u.is_admin ? <ShieldOff size={13} /> : <ShieldCheck size={13} />}
                      {u.is_admin ? 'Quitar admin' : 'Hacer admin'}
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleToggle(u)}
                    >
                      {u.is_active ? <UserX size={13} /> : <UserCheck size={13} />}
                      {u.is_active ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal crear usuario */}
      {showCreate && (
        <Modal onClose={() => setShowCreate(false)} title="Nuevo usuario">
          <form onSubmit={handleCreate}>
            <div className="form-group">
              <label>Nombre de usuario</label>
              <input
                className="form-control"
                type="text"
                value={createForm.username}
                onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                placeholder="ej: juan"
                autoFocus
                required
              />
            </div>
            <div className="form-group">
              <label>Contraseña inicial</label>
              <input
                className="form-control"
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                placeholder="Mínimo 6 caracteres"
                required
              />
              <small style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                El usuario deberá cambiarla en su primer ingreso.
              </small>
            </div>
            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <input
                type="checkbox"
                id="is_admin"
                checked={createForm.is_admin}
                onChange={(e) => setCreateForm({ ...createForm, is_admin: e.target.checked })}
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              <label htmlFor="is_admin" style={{ marginBottom: 0, cursor: 'pointer' }}>
                Administrador
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button type="submit" className="btn btn-primary" disabled={creating}>
                {creating ? 'Creando...' : 'Crear usuario'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>
                Cancelar
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal resetear contraseña */}
      {resetModal && (
        <Modal
          onClose={() => setResetModal(null)}
          title={`Resetear contraseña — ${resetModal.username}`}
        >
          <form onSubmit={handleReset}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 16 }}>
              El usuario deberá cambiar esta contraseña en su próximo ingreso.
            </p>
            <div className="form-group">
              <label>Contraseña temporal</label>
              <input
                className="form-control"
                type="text"
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                autoFocus
                required
              />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button type="submit" className="btn btn-primary" disabled={resetting}>
                {resetting ? 'Guardando...' : 'Restablecer'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setResetModal(null)}>
                Cancelar
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
