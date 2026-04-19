import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Calculadora from './Calculadora';
import GlobalSearch from './GlobalSearch';
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
  MoreHorizontal,
  Search,
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/clientes', icon: Users, label: 'Clientes' },
  { to: '/prestamos', icon: Banknote, label: 'Préstamos' },
  { to: '/mora', icon: AlertTriangle, label: 'Mora' },
  { to: '/calendario', icon: CalendarDays, label: 'Calendario' },
];

// Bottom nav muestra solo los primeros 4 + botón "Más"
const bottomNavMain = navItems.slice(0, 4);

export default function Layout() {
  const { logout, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [showCalc, setShowCalc] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const closeMore = () => setShowMore(false);

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
      {showSearch && <GlobalSearch onClose={() => setShowSearch(false)} />}

      {/* Bottom nav — mobile */}
      <nav className="bottom-nav">
        {bottomNavMain.map((item) => (
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
        <button
          className={`bottom-nav-item ${showMore ? 'active' : ''}`}
          onClick={() => setShowMore(true)}
        >
          <MoreHorizontal size={22} />
          <span>Más</span>
        </button>
      </nav>

      {/* Bottom sheet — "Más" */}
      {showMore && (
        <div
          className="bottom-sheet-overlay"
          onClick={closeMore}
        >
          <div
            className="bottom-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bottom-sheet-handle" />

            <NavLink
              to="/calendario"
              className={({ isActive }) =>
                `bottom-sheet-item ${isActive ? 'active' : ''}`
              }
              onClick={closeMore}
            >
              <CalendarDays size={20} />
              Calendario
            </NavLink>

            <button
              className="bottom-sheet-item"
              onClick={() => { setShowSearch(true); closeMore(); }}
            >
              <Search size={20} />
              Buscar
            </button>

            <button
              className="bottom-sheet-item"
              onClick={() => { setShowCalc(true); closeMore(); }}
            >
              <Calculator size={20} />
              Calculadora
            </button>

            {isAdmin && (
              <NavLink
                to="/usuarios"
                className={({ isActive }) =>
                  `bottom-sheet-item ${isActive ? 'active' : ''}`
                }
                onClick={closeMore}
              >
                <ShieldCheck size={20} />
                Usuarios
              </NavLink>
            )}

            <div className="bottom-sheet-divider" />

            <button className="bottom-sheet-item" onClick={() => { toggleTheme(); closeMore(); }}>
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
              {theme === 'light' ? 'Modo oscuro' : 'Modo claro'}
            </button>

            <button className="bottom-sheet-item bottom-sheet-danger" onClick={handleLogout}>
              <LogOut size={20} />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
