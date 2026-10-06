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
import type { User, RoleName } from '../types';
import { ROLE_PERMISSIONS, hasPermission as checkPerm, hasAnyPermission as checkAnyPerm } from '../constants/permissions';

export type { User, RoleName };
export type LoginUser = User;

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password?: string) => Promise<User>;
  logout: () => Promise<void>;
  switchPersona: (role: RoleName) => Promise<void>;
  hasPermission: (code: string) => boolean;
  hasAnyPermission: (...codes: string[]) => boolean;
  hasAllPermissions: (...codes: string[]) => boolean;
  userPermissions: string[];
}

const DEMO_EMAILS: Record<RoleName, string> = {
  ADMIN: 'admin@hope.dev',
  COORDINATOR: 'coordinator@hope.dev',
  MENTOR: 'mentor@hope.dev',
  FACULTY: 'faculty@hope.dev',
  TRAINER: 'trainer@hope.dev',
  STUDENT: 'student@hope.dev',
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    restoreSession()
      .then((restored) => setUser(restored))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password?: string): Promise<User> => {
    setLoading(true);
    try {
      const result = await doLogin(email, password);
      setUser(result.user);
      return result.user;
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
      setLoading(false);
    }
  }, []);

  const switchPersona = useCallback(async (role: RoleName) => {
    const email = DEMO_EMAILS[role];
    if (email) {
      setLoading(true);
      try {
        const result = await doLogin(email);
        setUser(result.user);
      } finally {
        setLoading(false);
      }
    }
  }, []);

  const hasPermission = useCallback(
    (code: string): boolean => checkPerm(user?.role, code),
    [user?.role],
  );

  const hasAnyPermission = useCallback(
    (...codes: string[]): boolean => checkAnyPerm(user?.role, ...codes),
    [user?.role],
  );

  const hasAllPermissions = useCallback(
    (...codes: string[]): boolean => {
      if (!user?.role) return false;
      const list = ROLE_PERMISSIONS[user.role] || [];
      return codes.every((c) => list.includes(c));
    },
    [user?.role],
  );

  const userPermissions = user?.role ? ROLE_PERMISSIONS[user.role] || [] : [];

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        switchPersona,
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
