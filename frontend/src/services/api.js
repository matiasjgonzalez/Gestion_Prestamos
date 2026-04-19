import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';

// ─── Cache en memoria ───
const cache = new Map();
const CACHE_TTL = 120_000;

function getCached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  cache.delete(key);
  return null;
}

function setCache(key, data) {
  cache.set(key, { data, ts: Date.now() });
}

export function invalidateCache(prefix) {
  for (const key of cache.keys()) {
    if (!prefix || key.startsWith(prefix)) cache.delete(key);
  }
}

// ─── Axios instance ───
const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const { status, data } = error.response || {};
    if (error.response && status === 401 && !window.location.pathname.includes('/login')) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    error.userMessage = data?.detail || data?.message || 'Error de conexión';
    return Promise.reject(error);
  }
);

async function cachedGet(url, params = {}) {
  const key = url + JSON.stringify(params);
  const cached = getCached(key);
  if (cached) return { data: cached };
  const res = await api.get(url, { params });
  setCache(key, res.data);
  return res;
}

// ─── Auth ───
export const login = (username, password) => {
  const form = new URLSearchParams();
  form.append('username', username);
  form.append('password', password);
  return api.post('/auth/login', form, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
};

// ─── Clientes ───
export const getClientes = (search = '', params = {}) =>
  cachedGet('/clientes/', search ? { search, ...params } : params);

export const getCliente = (id) => cachedGet(`/clientes/${id}`);

export const createCliente = (data) => {
  invalidateCache('/clientes');
  return api.post('/clientes/', data);
};

export const updateCliente = (id, data) => {
  invalidateCache('/clientes');
  return api.put(`/clientes/${id}`, data);
};

export const deleteCliente = (id) => {
  invalidateCache('/clientes');
  return api.delete(`/clientes/${id}`);
};

// ─── Préstamos ───
export const getPrestamos = (params = {}) => cachedGet('/prestamos/', params);

export const getPrestamoCompleto = (id) => cachedGet(`/prestamos/${id}/completo`);

export const createPrestamo = (data) => {
  invalidateCache('/prestamos');
  return api.post('/prestamos/', data);
};

export const deletePrestamo = (id) => {
  invalidateCache('/prestamos');
  return api.delete(`/prestamos/${id}`);
};

export const getDashboard = (params = {}) => cachedGet('/prestamos/dashboard', params);

export const marcarCuotaPagada = (prestamoId, cuotaId) => {
  invalidateCache('/prestamos');
  return api.post(`/prestamos/${prestamoId}/cuotas/${cuotaId}/marcar-pagada`);
};

export const desmarcarCuotaPagada = (prestamoId, cuotaId) => {
  invalidateCache('/prestamos');
  return api.post(`/prestamos/${prestamoId}/cuotas/${cuotaId}/desmarcar-pagada`);
};

export const refinanciarPrestamo = (prestamoId, cuotasDetalle) => {
  invalidateCache('/prestamos');
  return api.post(`/prestamos/${prestamoId}/refinanciar`, { cuotas_detalle: cuotasDetalle });
};

export const downloadEstadoCuenta = (clienteId, nombreCliente) =>
  downloadExcel(`/clientes/${clienteId}/estado-cuenta/xlsx`, `${nombreCliente}_estado_cuenta.xlsx`);

export const cancelarPrestamo = (id) => {
  invalidateCache('/prestamos');
  return api.post(`/prestamos/${id}/cancelar`);
};

export const updateCuota = (prestamoId, cuotaId, data) => {
  invalidateCache('/prestamos');
  return api.put(`/prestamos/${prestamoId}/cuotas/${cuotaId}`, data);
};

export const updateNotas = (prestamoId, notas) => {
  invalidateCache(`/prestamos/${prestamoId}`);
  return api.patch(`/prestamos/${prestamoId}/notas`, { notas });
};

export const getClienteResumen = (id) => cachedGet(`/clientes/${id}/resumen`);

// ─── Usuarios ───
export const getUsuarios = () => cachedGet('/usuarios/');

export const createUsuario = (data) => {
  invalidateCache('/usuarios');
  return api.post('/usuarios/', data);
};

export const resetPasswordUsuario = (id, temp_password) => {
  invalidateCache('/usuarios');
  return api.put(`/usuarios/${id}/reset-password`, { temp_password });
};

export const toggleActiveUsuario = (id) => {
  invalidateCache('/usuarios');
  return api.put(`/usuarios/${id}/toggle-active`);
};

export const toggleRoleUsuario = (id) => {
  invalidateCache('/usuarios');
  return api.put(`/usuarios/${id}/toggle-role`);
};

export const changePassword = (new_password) =>
  api.post('/usuarios/change-password', { new_password });

export const getMe = () => api.get('/auth/me');

// ─── Export Excel / Archivos ───
export async function downloadExcel(url, filename) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}${url}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    let detail = 'Error al descargar el archivo';
    try {
      const json = await res.json();
      detail = json.detail || detail;
    } catch (_) {}
    throw new Error(detail);
  }
  const blob = await res.blob();
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

// ─── Importación / Backup ───
export const downloadTemplate = () =>
  downloadExcel('/clientes/import/template', 'plantilla_clientes.xlsx');

export const importClientes = (file) => {
  invalidateCache('/clientes');
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/clientes/import/xlsx', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const downloadBackup = () =>
  downloadExcel('/backup/zip', `backup_${new Date().toISOString().slice(0, 10)}.zip`);

// ─── Pagos ───
export const registrarPago = (data) => {
  invalidateCache('/prestamos');
  return api.post('/pagos/', data);
};

// ─── Calendario ───
export const getCalendario = (mes, anio) =>
  cachedGet('/calendario', { mes, anio });

// ─── Mora ───
export const verificarMora = () => {
  invalidateCache('/mora');
  return api.post('/mora/verificar');
};

export const getMora = (params = {}) => cachedGet('/mora/', params);

export const getMoraClientes = (params = {}) => cachedGet('/mora/clientes', params);

// ─── Archivos ───
export const getArchivos = (clienteId) =>
  api.get(`/clientes/${clienteId}/archivos`);

export const subirArchivo = (clienteId, tipo, file) => {
  invalidateCache('/clientes');
  const formData = new FormData();
  formData.append('file', file);
  return api.post(`/clientes/${clienteId}/archivos/${tipo}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const eliminarArchivo = (clienteId, tipo) => {
  invalidateCache('/clientes');
  return api.delete(`/clientes/${clienteId}/archivos/${tipo}`);
};

export const downloadArchivo = async (clienteId, tipo, nombreArchivo) => {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}/clientes/${clienteId}/archivos/${tipo}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Error al descargar archivo');
  const blob = await res.blob();
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = nombreArchivo;
  link.click();
  URL.revokeObjectURL(link.href);
};

export const downloadMoraZip = () =>
  downloadExcel('/mora/export/zip', 'mora.zip');

export default api;
