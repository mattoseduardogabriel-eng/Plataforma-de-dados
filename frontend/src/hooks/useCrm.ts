import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Activity, CrmOverview, Deal, Lead, Pipeline, TeamPerformance } from '@/types';

export function usePipelines() {
  return useQuery({
    queryKey: ['crm', 'pipelines'],
    queryFn: async () => (await api.get<Pipeline[]>('/crm/pipelines')).data,
  });
}

export function useLeads(params: { status?: string; search?: string } = {}) {
  return useQuery({
    queryKey: ['crm', 'leads', params],
    queryFn: async () => (await api.get<Lead[]>('/crm/leads', { params })).data,
  });
}

export function useLead(id?: string) {
  return useQuery({
    queryKey: ['crm', 'leads', id],
    queryFn: async () => (await api.get(`/crm/leads/${id}`)).data,
    enabled: !!id,
  });
}

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => (await api.post('/crm/leads', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'leads'] }),
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Record<string, unknown>) =>
      (await api.patch(`/crm/leads/${id}`, payload)).data,
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['crm', 'leads'] });
      qc.invalidateQueries({ queryKey: ['crm', 'leads', variables.id] });
    },
  });
}

export interface Sector {
  id: string;
  name: string;
}

export function useSectors() {
  return useQuery({
    queryKey: ['crm', 'sectors'],
    queryFn: async () => (await api.get<Sector[]>('/crm/sectors')).data,
  });
}

export function useCreateSector() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => (await api.post<Sector>('/crm/sectors', { name })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'sectors'] }),
  });
}

export function useDeleteSector() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/crm/sectors/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'sectors'] }),
  });
}

export function useDeals(params: { pipelineId?: string; stageId?: string; status?: string } = {}) {
  return useQuery({
    queryKey: ['crm', 'deals', params],
    queryFn: async () => (await api.get<Deal[]>('/crm/deals', { params })).data,
  });
}

export function useDeal(id?: string) {
  return useQuery({
    queryKey: ['crm', 'deals', id],
    queryFn: async () => (await api.get(`/crm/deals/${id}`)).data,
    enabled: !!id,
  });
}

export function useCreateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => (await api.post('/crm/deals', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'deals'] }),
  });
}

export function useMoveDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, stageId }: { id: string; stageId: string }) =>
      (await api.patch(`/crm/deals/${id}/move`, { stageId })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'deals'] });
      qc.invalidateQueries({ queryKey: ['crm', 'dashboard'] });
      qc.invalidateQueries({ queryKey: ['post-sale'] });
    },
  });
}

export function useCloseDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, outcome, lostReason }: { id: string; outcome: 'GANHO' | 'PERDIDO'; lostReason?: string }) =>
      (await api.patch(`/crm/deals/${id}/close`, { outcome, lostReason })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm'] });
      qc.invalidateQueries({ queryKey: ['post-sale'] });
    },
  });
}

export function useActivities(params: { dealId?: string; leadId?: string } = {}) {
  return useQuery({
    queryKey: ['crm', 'activities', params],
    queryFn: async () => (await api.get<Activity[]>('/crm/activities', { params })).data,
    enabled: !!(params.dealId || params.leadId),
  });
}

export function useCreateActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => (await api.post('/crm/activities', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'activities'] }),
  });
}

export function useMarkActivityDone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.patch(`/crm/activities/${id}/done`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'activities'] }),
  });
}

export function useCrmOverview() {
  return useQuery({
    queryKey: ['crm', 'dashboard', 'overview'],
    queryFn: async () => (await api.get<CrmOverview>('/crm/dashboard/overview')).data,
  });
}

export function useTeamPerformance() {
  return useQuery({
    queryKey: ['crm', 'dashboard', 'team'],
    queryFn: async () => (await api.get<TeamPerformance[]>('/crm/dashboard/team')).data,
  });
}
