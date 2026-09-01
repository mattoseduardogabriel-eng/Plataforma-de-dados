import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { LiroCrmStatus, LiroCrmSyncResult } from '@/types';

export function useLiroCrmStatus() {
  return useQuery({
    queryKey: ['integrations', 'liro-crm'],
    queryFn: async () => (await api.get<LiroCrmStatus>('/integrations/liro-crm')).data,
  });
}

export function useSaveLiroCrmCredentials() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { apiKey: string; baseUrl: string }) =>
      (await api.put<LiroCrmStatus>('/integrations/liro-crm', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations', 'liro-crm'] }),
  });
}

export function useRemoveLiroCrmCredentials() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.delete<LiroCrmStatus>('/integrations/liro-crm')).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations', 'liro-crm'] }),
  });
}

export function useTestLiroCrmConnection() {
  return useMutation({
    mutationFn: async () => (await api.post<{ success: boolean }>('/integrations/liro-crm/test')).data,
  });
}

export function useSyncLiroCrmContacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post<LiroCrmSyncResult>('/integrations/liro-crm/sync')).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integrations', 'liro-crm'] });
      qc.invalidateQueries({ queryKey: ['crm', 'leads'] });
    },
  });
}

export function usePushLiroCrmTag() {
  return useMutation({
    mutationFn: async ({ leadId, tagName }: { leadId: string; tagName: string }) =>
      (await api.post<{ success: boolean }>(`/integrations/liro-crm/leads/${leadId}/tags`, { tagName })).data,
  });
}
