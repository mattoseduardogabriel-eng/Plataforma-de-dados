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

// undefined = login concluído normal. { twoFactorRequired: true, pendingToken }
// = senha certa, mas a conta exige o segundo fator — a tela de login chama
// loginTwoFactor com esse pendingToken + o código do app autenticador pra
// terminar de entrar.
type LoginResult = { twoFactorRequired: true; pendingToken: string } | undefined;

interface AuthContextValue {
  user: User | null;
  organization: Organization | null;
  loading: boolean;
  login: (payload: LoginPayload) => Promise<LoginResult>;
  loginTwoFactor: (pendingToken: string, token: string) => Promise<void>;
  // Não loga automaticamente — a empresa entra pendente de aprovação do dono
  // da plataforma. Retorna a mensagem pra exibir na tela de cadastro.
  registerOrganization: (payload: RegisterOrganizationPayload) => Promise<{ message: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
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

  const login = useCallback(async (payload: LoginPayload): Promise<LoginResult> => {
    const { data } = await api.post('/auth/login', payload);
    if (data.twoFactorRequired) {
      return { twoFactorRequired: true, pendingToken: data.pendingToken };
    }
    setAccessToken(data.accessToken);
    setUser(data.user);
    await loadMe();
    return undefined;
  }, [loadMe]);

  const loginTwoFactor = useCallback(async (pendingToken: string, token: string) => {
    const { data } = await api.post('/auth/login/2fa', { pendingToken, token });
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
    () => ({ user, organization, loading, login, loginTwoFactor, registerOrganization, logout, refreshUser: loadMe }),
    [user, organization, loading, login, loginTwoFactor, registerOrganization, logout, loadMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}

export { extractErrorMessage };
