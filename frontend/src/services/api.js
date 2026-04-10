import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: API_URL,
});

// Interceptor: agregar token a cada request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor: si 401, redirigir a login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (!window.location.pathname.includes('/login')) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const login = (username, password) => {
  const formData = new URLSearchParams();
  formData.append('username', username);
  formData.append('password', password);
  return api.post('/auth/login', formData, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
};

// Clientes
export const getClientes = (search = '') =>
  api.get('/clientes/', { params: search ? { search } : {} });
export const getCliente = (id) => api.get(`/clientes/${id}`);
export const createCliente = (data) => api.post('/clientes/', data);
export const updateCliente = (id, data) => api.put(`/clientes/${id}`, data);
export const deleteCliente = (id) => api.delete(`/clientes/${id}`);

// Prestamos
export const getPrestamos = () => api.get('/prestamos/');
export const getPrestamo = (id) => api.get(`/prestamos/${id}`);
export const createPrestamo = (data) => api.post('/prestamos/', data);
export const deletePrestamo = (id) => api.delete(`/prestamos/${id}`);
export const getDeuda = (id) => api.get(`/prestamos/${id}/deuda`);
export const getCuotas = (id) => api.get(`/prestamos/${id}/cuotas`);
export const updateCuota = (prestamoId, cuotaId, data) =>
  api.put(`/prestamos/${prestamoId}/cuotas/${cuotaId}`, data);

// Pagos
export const registrarPago = (data) => api.post('/pagos/', data);
export const getPagos = (prestamoId) =>
  api.get('/pagos/', { params: prestamoId ? { prestamo_id: prestamoId } : {} });

// Dashboard
export const getDashboard = () => api.get('/prestamos/dashboard');

// Mora
export const verificarMora = () => api.post('/mora/verificar');
export const getMora = () => api.get('/mora/');

export default api;
