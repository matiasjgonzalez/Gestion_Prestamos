import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Calculadora from './Calculadora';
import {
  LayoutDashboard,
  Users,
  Banknote,
  AlertTriangle,
  LogOut,
  Sun,
  Moon,
  ShieldCheck,
  Calculator,
  CalendarDays,
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/clientes', icon: Users, label: 'Clientes' },
  { to: '/prestamos', icon: Banknote, label: 'Préstamos' },
  { to: '/mora', icon: AlertTriangle, label: 'Mora' },
  { to: '/calendario', icon: CalendarDays, label: 'Calendario' },
];

export default function Layout() {
  const { logout, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [showCalc, setShowCalc] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>
            <span>$</span> Préstamos
          </h1>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''}`
              }
            >
              <item.icon />
              {item.label}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink
              to="/usuarios"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <ShieldCheck />
              Usuarios
            </NavLink>
          )}
        </nav>
        <div style={{ padding: '0 12px 8px' }}>
          <button className="sidebar-link" onClick={() => setShowCalc(true)}>
            <Calculator />
            Calculadora
          </button>
        </div>
        <div className="sidebar-footer">
          <button className="theme-toggle" onClick={toggleTheme}>
            {theme === 'light' ? <Moon /> : <Sun />}
            {theme === 'light' ? 'Modo oscuro' : 'Modo claro'}
          </button>
          <button className="sidebar-link" onClick={handleLogout}>
            <LogOut />
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
      {showCalc && <Calculadora onClose={() => setShowCalc(false)} />}
      <nav className="bottom-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `bottom-nav-item ${isActive ? 'active' : ''}`
            }
          >
            <item.icon size={22} />
            <span>{item.label}</span>
          </NavLink>
        ))}
        {isAdmin && (
          <NavLink
            to="/usuarios"
            className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
          >
            <ShieldCheck size={22} />
            <span>Usuarios</span>
          </NavLink>
        )}
        <button className="bottom-nav-item" onClick={() => setShowCalc(true)}>
          <Calculator size={22} />
          <span>Calc</span>
        </button>
        <button className="bottom-nav-item" onClick={toggleTheme}>
          {theme === 'light' ? <Moon size={22} /> : <Sun size={22} />}
          <span>{theme === 'light' ? 'Oscuro' : 'Claro'}</span>
        </button>
        <button className="bottom-nav-item" onClick={handleLogout}>
          <LogOut size={22} />
          <span>Salir</span>
        </button>
      </nav>
    </div>
  );
}
