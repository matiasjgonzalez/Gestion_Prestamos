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

export const getDashboard = () => cachedGet('/prestamos/dashboard');

export const marcarCuotaPagada = (prestamoId, cuotaId) => {
  invalidateCache('/prestamos');
  return api.post(`/prestamos/${prestamoId}/cuotas/${cuotaId}/marcar-pagada`);
};

export const cancelarPrestamo = (id) => {
  invalidateCache('/prestamos');
  return api.post(`/prestamos/${id}/cancelar`);
};

export const updateCuota = (prestamoId, cuotaId, data) => {
  invalidateCache('/prestamos');
  return api.put(`/prestamos/${prestamoId}/cuotas/${cuotaId}`, data);
};

export const getClienteResumen = (id) => cachedGet(`/clientes/${id}/resumen`);

// ─── Pagos ───
export const registrarPago = (data) => {
  invalidateCache('/prestamos');
  return api.post('/pagos/', data);
};

// ─── Mora ───
export const verificarMora = () => {
  invalidateCache('/mora');
  return api.post('/mora/verificar');
};

export const getMora = () => cachedGet('/mora/');

export default api;
