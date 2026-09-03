import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface TwoFactorSetup {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

// 2FA (TOTP) — só ADMIN/GESTOR (ver TwoFactorController no backend).
export function useTwoFactorStatus() {
  return useQuery({
    queryKey: ['two-factor', 'status'],
    queryFn: async () => (await api.get<{ enabled: boolean }>('/2fa/status')).data,
  });
}

export function useSetupTwoFactor() {
  return useMutation({
    mutationFn: async () => (await api.post<TwoFactorSetup>('/2fa/setup')).data,
  });
}

export function useEnableTwoFactor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (token: string) => (await api.post('/2fa/enable', { token })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['two-factor', 'status'] }),
  });
}

export function useDisableTwoFactor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { token?: string; password?: string }) => (await api.post('/2fa/disable', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['two-factor', 'status'] }),
  });
}
