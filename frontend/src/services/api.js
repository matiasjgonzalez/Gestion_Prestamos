import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';
const isDev = import.meta.env.DEV;

// ─── Logger simple (solo en desarrollo) ───
const logger = {
  log: (msg, data) => { if (isDev) console.log(`[API] ${msg}`, data || ''); },
  error: (msg, err) => { console.error(`[API ERROR] ${msg}`, err || ''); },
};

// ─── Cache en memoria ───
const cache = new Map();
const CACHE_TTL = 30_000; // 30 segundos

function getCached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) {
    logger.log(`Cache HIT: ${key}`);
    return entry.data;
  }
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
  logger.log(`${config.method?.toUpperCase()} ${config.url}`);
  return config;
});

api.interceptors.response.use(
  (response) => {
    logger.log(`✓ ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    const { status, data } = error.response || {};
    logger.error(`${status || 'NETWORK'} ${error.config?.url}`, data);

    // Solo redirigir si realmente es 401 (no timeout/network error)
    if (error.response && status === 401) {
      if (!window.location.pathname.includes('/login')) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }

    error.userMessage = data?.detail || data?.message || 'Error de conexión';
    return Promise.reject(error);
  }
);

// ─── Helper: GET con cache ───
async function cachedGet(url, params = {}) {
  const key = url + JSON.stringify(params);
  const cached = getCached(key);
  if (cached) return { data: cached };
  const res = await api.get(url, { params });
  setCache(key, res.data);
  return res;
}

// ─── Auth ───
export const authAPI = {
  login: (username, password) => {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    return api.post('/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  },
};

// ─── Clientes ───
export const clientesAPI = {
  getAll: (search = '') =>
    cachedGet('/clientes/', search ? { search } : {}),
  getById: (id) => cachedGet(`/clientes/${id}`),
  create: (data) => {
    invalidateCache('/clientes');
    return api.post('/clientes/', data);
  },
  update: (id, data) => {
    invalidateCache('/clientes');
    return api.put(`/clientes/${id}`, data);
  },
  delete: (id) => {
    invalidateCache('/clientes');
    return api.delete(`/clientes/${id}`);
  },
};

// ─── Préstamos ───
export const prestamosAPI = {
  getAll: () => cachedGet('/prestamos/'),
  getById: (id) => cachedGet(`/prestamos/${id}`),
  getCompleto: (id) => cachedGet(`/prestamos/${id}/completo`),
  create: (data) => {
    invalidateCache('/prestamos');
    return api.post('/prestamos/', data);
  },
  delete: (id) => {
    invalidateCache('/prestamos');
    return api.delete(`/prestamos/${id}`);
  },
  getDeuda: (id) => api.get(`/prestamos/${id}/deuda`),
  getCuotas: (id) => cachedGet(`/prestamos/${id}/cuotas`),
  updateCuota: (prestamoId, cuotaId, data) => {
    invalidateCache('/prestamos');
    return api.put(`/prestamos/${prestamoId}/cuotas/${cuotaId}`, data);
  },
  getDashboard: () => api.get('/prestamos/dashboard'),
  marcarCuotaPagada: (prestamoId, cuotaId) => {
    invalidateCache('/prestamos');
    return api.post(`/prestamos/${prestamoId}/cuotas/${cuotaId}/marcar-pagada`);
  },
  cancelarPrestamo: (id) => {
    invalidateCache('/prestamos');
    return api.post(`/prestamos/${id}/cancelar`);
  },
};

// ─── Pagos ───
export const pagosAPI = {
  registrar: (data) => {
    invalidateCache('/prestamos');
    invalidateCache('/pagos');
    return api.post('/pagos/', data);
  },
  getAll: (prestamoId) =>
    cachedGet('/pagos/', prestamoId ? { prestamo_id: prestamoId } : {}),
};

// ─── Mora ───
export const moraAPI = {
  verificar: () => api.post('/mora/verificar'),
  getAll: () => cachedGet('/mora/'),
};

// ─── Compatibilidad (no romper imports existentes) ───
export const login = (u, p) => authAPI.login(u, p);
export const getClientes = (s) => clientesAPI.getAll(s);
export const getCliente = (id) => clientesAPI.getById(id);
export const createCliente = (d) => clientesAPI.create(d);
export const updateCliente = (id, d) => clientesAPI.update(id, d);
export const deleteCliente = (id) => clientesAPI.delete(id);
export const getPrestamos = () => prestamosAPI.getAll();
export const getPrestamo = (id) => prestamosAPI.getById(id);
export const getPrestamoCompleto = (id) => prestamosAPI.getCompleto(id);
export const createPrestamo = (d) => prestamosAPI.create(d);
export const deletePrestamo = (id) => prestamosAPI.delete(id);
export const getDeuda = (id) => prestamosAPI.getDeuda(id);
export const getCuotas = (id) => prestamosAPI.getCuotas(id);
export const updateCuota = (pId, cId, d) => prestamosAPI.updateCuota(pId, cId, d);
export const registrarPago = (d) => pagosAPI.registrar(d);
export const getPagos = (pId) => pagosAPI.getAll(pId);
export const getDashboard = () => prestamosAPI.getDashboard();
export const marcarCuotaPagada = (pId, cId) => prestamosAPI.marcarCuotaPagada(pId, cId);
export const cancelarPrestamo = (id) => prestamosAPI.cancelarPrestamo(id);
export const verificarMora = () => moraAPI.verificar();
export const getMora = () => moraAPI.getAll();

export default api;
