import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setUnauthorizedHandler, tokenStore } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => tokenStore.get());
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));

  const clear = useCallback(() => {
    tokenStore.set(null);
    setToken(null);
    setUser(null);
  }, []);

  // Restore the session on page load.
  useEffect(() => {
    setUnauthorizedHandler(clear);
    if (!token) return;
    api.get('/auth/me')
      .then((d) => setUser(d.user))
      .catch(clear)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const accept = (d) => {
    tokenStore.set(d.token);
    setToken(d.token);
    setUser(d.user);
    return d.user;
  };

  const value = useMemo(() => ({
    user,
    token,
    loading,
    login: async (email, password) => accept(await api.post('/auth/login', { email, password })),
    register: async (body) => accept(await api.post('/auth/register', body)),
    logout: async () => {
      try { await api.post('/auth/logout'); } catch { /* token may already be invalid */ }
      clear();
    },
    setUser,
    refreshUser: async () => {
      const d = await api.get('/auth/me');
      setUser(d.user);
      return d.user;
    },
  }), [user, token, loading, clear]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
