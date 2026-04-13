import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import { lazy, Suspense } from 'react';

// Lazy loading: cada página se carga solo cuando se navega a ella
const LoginPage = lazy(() => import('./pages/LoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ClientesPage = lazy(() => import('./pages/ClientesPage'));
const ClienteDetailPage = lazy(() => import('./pages/ClienteDetailPage'));
const PrestamosPage = lazy(() => import('./pages/PrestamosPage'));
const PrestamoDetailPage = lazy(() => import('./pages/PrestamoDetailPage'));
const MoraPage = lazy(() => import('./pages/MoraPage'));

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
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
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
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1c1f2e',
              color: '#e8e9ed',
              border: '1px solid #2a2d3e',
              fontSize: '0.85rem',
            },
          }}
        />
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
