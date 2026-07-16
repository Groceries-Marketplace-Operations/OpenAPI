import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authApi } from '../api';

interface AuthCtx { user: any; loading: boolean; logout: () => void; }
const Ctx = createContext<AuthCtx>({ user: null, loading: true, logout: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    authApi.me().then(setUser).catch(() => localStorage.removeItem('token')).finally(() => setLoading(false));
  }, []);

  const logout = () => { localStorage.removeItem('token'); setUser(null); window.location.href = '/login'; };

  return <Ctx.Provider value={{ user, loading, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
