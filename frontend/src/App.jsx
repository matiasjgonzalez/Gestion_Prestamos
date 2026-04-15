import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useEffect } from 'react';
import { getDashboard, getMora } from './services/api';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import Layout from './components/Layout';
import { lazy, Suspense } from 'react';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const ChangePasswordPage = lazy(() => import('./pages/ChangePasswordPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ClientesPage = lazy(() => import('./pages/ClientesPage'));
const ClienteDetailPage = lazy(() => import('./pages/ClienteDetailPage'));
const PrestamosPage = lazy(() => import('./pages/PrestamosPage'));
const PrestamoDetailPage = lazy(() => import('./pages/PrestamoDetailPage'));
const MoraPage = lazy(() => import('./pages/MoraPage'));
const UsuariosPage = lazy(() => import('./pages/UsuariosPage'));
const CalendarioPage = lazy(() => import('./pages/CalendarioPage'));

function LoadingFallback() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '200px',
      color: 'var(--text-muted)',
      fontSize: '0.85rem',
    }}>
      Cargando...
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, mustChangePassword } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (mustChangePassword && window.location.pathname !== '/cambiar-password') {
    return <Navigate to="/cambiar-password" replace />;
  }
  return children;
}

function AdminRoute({ children }) {
  const { isAuthenticated, isAdmin } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}

function ThemedToaster() {
  const { theme } = useTheme();
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: theme === 'dark' ? '#1E293B' : '#0F172A',
          color: '#E2E8F0',
          border: `1px solid ${theme === 'dark' ? '#334155' : '#1E293B'}`,
          fontSize: '0.85rem',
        },
      }}
    />
  );
}

function AppRoutes() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/cambiar-password" element={<ChangePasswordPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="clientes" element={<ClientesPage />} />
          <Route path="clientes/:id" element={<ClienteDetailPage />} />
          <Route path="prestamos" element={<PrestamosPage />} />
          <Route path="prestamos/:id" element={<PrestamoDetailPage />} />
          <Route path="mora" element={<MoraPage />} />
          <Route path="usuarios" element={<AdminRoute><UsuariosPage /></AdminRoute>} />
          <Route path="calendario" element={<CalendarioPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  // Prefetch de datos pesados y keep-alive para evitar cold starts en Render
  function Prefetcher() {
    const { isAuthenticated } = useAuth();
    useEffect(() => {
      if (!isAuthenticated) return;
      Promise.allSettled([getDashboard(), getMora()]);
      // Ping cada 10 minutos para mantener el servidor activo
      const interval = setInterval(() => {
        fetch(`${import.meta.env.VITE_API_URL || ''}/ping`).catch(() => {});
      }, 10 * 60 * 1000);
      return () => clearInterval(interval);
    }, [isAuthenticated]);
    return null;
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Prefetcher />
          <ThemedToaster />
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
