/**
 * AuthContext.jsx  (Module 1 - frontend side)
 * ---------------
 * Keeps the logged-in user available to every component.
 *
 *   const { user, login, logout, can } = useAuth();
 *   if (can('USER_CREATE')) { ...show "Add User" button... }
 *
 * On page refresh we still have the token in localStorage, so we call
 * GET /auth/me to load the user again.
 */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api, { tokenStore } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true while we check an existing token

  // Load the current user once when the app starts
  useEffect(() => {
    if (!tokenStore.get()) { setLoading(false); return; }
    api.get('/auth/me')
      .then(({ data }) => setUser(data.user))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    tokenStore.set(data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch { /* token may already be invalid */ }
    tokenStore.clear();
    setUser(null);
  };

  const refreshUser = async () => {
    const { data } = await api.get('/auth/me');
    setUser(data.user);
  };

  /** true if the user has AT LEAST ONE of the given permission codes */
  const can = useCallback(
    (...codes) => !!user && codes.some((c) => user.permissions.includes(c)),
    [user],
  );

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
