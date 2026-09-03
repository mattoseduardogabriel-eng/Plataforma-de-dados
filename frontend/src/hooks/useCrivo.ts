import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CreditPolicy, CrivoDecision } from '@/types';

export function usePolicies() {
  return useQuery({
    queryKey: ['crivo', 'policies'],
    queryFn: async () => (await api.get<CreditPolicy[]>('/crivo/policies')).data,
  });
}

export function useCreatePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => (await api.post('/crivo/policies', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crivo', 'policies'] }),
  });
}

export function useUpdatePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Record<string, unknown>) =>
      (await api.patch(`/crivo/policies/${id}`, payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crivo', 'policies'] }),
  });
}

export function useDeletePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/crivo/policies/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crivo', 'policies'] }),
  });
}

export function useEvaluateCrivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { document: string; targetType: 'CNPJ' | 'CPF'; purpose: string; policyId?: string }) =>
      (await api.post<CrivoDecision>('/crivo/evaluate', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crivo', 'decisions'] }),
  });
}

export function useCrivoDecisions(targetDocument?: string) {
  return useQuery({
    queryKey: ['crivo', 'decisions', targetDocument],
    queryFn: async () =>
      (await api.get<CrivoDecision[]>('/crivo/decisions', { params: { targetDocument } })).data,
  });
}
