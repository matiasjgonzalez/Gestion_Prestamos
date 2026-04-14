import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

function parseToken(token) {
  if (!token) return {};
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch { return {}; }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [mustChangePassword, setMustChangePassword] = useState(
    localStorage.getItem('must_change_password') === 'true'
  );
  const [isAdmin, setIsAdmin] = useState(
    localStorage.getItem('is_admin') === 'true'
  );

  const isAuthenticated = !!token;

  const saveToken = (newToken, mustChange = false, admin = false) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('must_change_password', String(mustChange));
    localStorage.setItem('is_admin', String(admin));
    setToken(newToken);
    setMustChangePassword(mustChange);
    setIsAdmin(admin);
  };

  const clearMustChange = () => {
    localStorage.setItem('must_change_password', 'false');
    setMustChangePassword(false);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('must_change_password');
    localStorage.removeItem('is_admin');
    setToken(null);
    setMustChangePassword(false);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ token, isAuthenticated, isAdmin, mustChangePassword, saveToken, clearMustChange, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
