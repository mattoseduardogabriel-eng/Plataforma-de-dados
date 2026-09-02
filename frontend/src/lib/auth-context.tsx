import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, extractErrorMessage, getAccessToken, setAccessToken } from './api';
import type { Organization, User } from '@/types';

interface LoginPayload {
  email: string;
  password: string;
}

interface RegisterOrganizationPayload {
  organizationName: string;
  organizationCnpj?: string;
  name: string;
  email: string;
  password: string;
}

interface AuthContextValue {
  user: User | null;
  organization: Organization | null;
  loading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  // Não loga automaticamente — a empresa entra pendente de aprovação do dono
  // da plataforma. Retorna a mensagem pra exibir na tela de cadastro.
  registerOrganization: (payload: RegisterOrganizationPayload) => Promise<{ message: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data);
      setOrganization(data.organization ?? null);
    } catch {
      setUser(null);
      setOrganization(null);
      setAccessToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (getAccessToken()) {
      loadMe();
    } else {
      setLoading(false);
    }
    const handleLogout = () => {
      setUser(null);
      setOrganization(null);
    };
    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, [loadMe]);

  const login = useCallback(async (payload: LoginPayload) => {
    const { data } = await api.post('/auth/login', payload);
    setAccessToken(data.accessToken);
    setUser(data.user);
    await loadMe();
  }, [loadMe]);

  const registerOrganization = useCallback(async (payload: RegisterOrganizationPayload) => {
    const { data } = await api.post('/auth/register-organization', payload);
    return { message: data.message as string };
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore
    }
    setAccessToken(null);
    setUser(null);
    setOrganization(null);
  }, []);

  const value = useMemo(
    () => ({ user, organization, loading, login, registerOrganization, logout }),
    [user, organization, loading, login, registerOrganization, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}

export { extractErrorMessage };
