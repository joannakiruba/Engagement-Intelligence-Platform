// src/context/AuthContext.tsx
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import {
  login as doLogin,
  logout as doLogout,
  restoreSession,
} from '../services/auth.service';
import { User, RoleName } from '../types';
import { getTokenPermissions } from '../services/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (code: string) => boolean;
  hasAnyPermission: (...codes: string[]) => boolean;
  hasAllPermissions: (...codes: string[]) => boolean;
  userPermissions: string[];
}

const AuthContext = createContext<AuthContextType | null>(null);


export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const expire = () => setUser(null);
    window.addEventListener('hope:session-expired', expire);
    restoreSession().then(value => { if (active) setUser(value); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; window.removeEventListener('hope:session-expired', expire); };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const result = await doLogin(email, password);
      setUser(result.user);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await doLogout();
      setUser(null);
    } finally {
      setUser(null);
      setLoading(false);
    }
  }, []);

  const hasPermission = useCallback(
    (code: string): boolean => {
      return !!user && getTokenPermissions().includes(code);
    },
    [user?.role]
  );

  const hasAnyPermission = useCallback(
    (...codes: string[]): boolean => {
      return !!user && codes.some(code => getTokenPermissions().includes(code));
    },
    [user?.role]
  );

  const hasAllPermissions = useCallback(
    (...codes: string[]): boolean => {
      if (!user?.role) return false;
      const list = getTokenPermissions();
      return codes.every((c) => list.includes(c));
    },
    [user?.role]
  );

  const userPermissions = user ? getTokenPermissions() : [];

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        userPermissions,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
