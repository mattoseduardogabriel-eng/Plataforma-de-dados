import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Activity, CrmOverview, Deal, Lead, Pipeline, TeamPerformance } from '@/types';

export function usePipelines() {
  return useQuery({
    queryKey: ['crm', 'pipelines'],
    queryFn: async () => (await api.get<Pipeline[]>('/crm/pipelines')).data,
  });
}

export function useCreatePipelineStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ pipelineId, name }: { pipelineId: string; name: string }) =>
      (await api.post(`/crm/pipelines/${pipelineId}/stages`, { name })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'pipelines'] }),
  });
}

export function useDeletePipelineStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (stageId: string) => (await api.delete(`/crm/pipelines/stages/${stageId}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'pipelines'] }),
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
    queryFn: async () => (await api.get<Lead & { activities: Activity[] }>(`/crm/leads/${id}`)).data,
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

/** Mescla o lead achado pelo telefone informado DENTRO do lead `id` — resolve duplicata legada (mesmo telefone, dois leads separados). */
export function useMergeLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, phone }: { id: string; phone: string }) => (await api.post(`/crm/leads/${id}/merge`, { phone })).data,
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['crm', 'leads'] });
      qc.invalidateQueries({ queryKey: ['crm', 'leads', variables.id] });
      qc.invalidateQueries({ queryKey: ['crm', 'deals'] });
    },
  });
}

// "Salvar na carteira": cria o Customer (Pós-venda) direto do lead, sem
// passar pelo funil de negociação. Deixa passar o nome ajustado (o
// contato do WhatsApp às vezes só tem telefone).
export function useSaveLeadToWallet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name?: string }) =>
      (await api.post(`/crm/leads/${id}/save-to-wallet`, { name })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'leads'] });
      qc.invalidateQueries({ queryKey: ['post-sale', 'customers'] });
      qc.invalidateQueries({ queryKey: ['post-sale', 'portfolio'] });
    },
  });
}

export type SaveLeadsToWalletBulkResultado =
  | { leadId: string; status: 'criado'; customerId: string }
  | { leadId: string; status: 'ja_estava_na_carteira'; customerId: string }
  | { leadId: string; status: 'nao_encontrado' };

export function useSaveLeadsToWalletBulk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: { leadId: string; name?: string }[]) =>
      (await api.post<SaveLeadsToWalletBulkResultado[]>('/crm/leads/save-to-wallet/bulk', { items })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'leads'] });
      qc.invalidateQueries({ queryKey: ['post-sale', 'customers'] });
      qc.invalidateQueries({ queryKey: ['post-sale', 'portfolio'] });
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
    // Funil de Vendas também muda por fora (webhook do Liro CRM movendo um
    // negócio em tempo real) — sem isso só atualiza na tela quando ALGUÉM
    // aqui mexe em algo, nunca por causa do que aconteceu do lado de lá.
    refetchInterval: 5000,
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'deals'] });
      // Pode ter criado um lead novo por trás (ver contactName/contactPhone
      // em CreateDealDto), então a lista de Leads também pode ter mudado.
      qc.invalidateQueries({ queryKey: ['crm', 'leads'] });
    },
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

/**
 * Move várias negociações pra uma mesma etapa de uma vez (seleção em
 * retângulo no Funil de Vendas) — chama a MESMA rota de mover uma por uma
 * (`PATCH /crm/deals/:id/move`), em vez de reimplementar a lógica de
 * mover no back-end: assim cada negócio passa exatamente pelas mesmas
 * regras de sempre (virar cliente se cair numa etapa "Ganho", refletir no
 * Liro CRM, etc.), sem duplicar esse comportamento numa rota em lote.
 */
export function useMoveDeals() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, stageId }: { ids: string[]; stageId: string }) => {
      const resultados = await Promise.allSettled(ids.map((id) => api.patch(`/crm/deals/${id}/move`, { stageId })));
      const falhas = resultados.filter((r) => r.status === 'rejected').length;
      return { total: ids.length, falhas };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'deals'] });
      qc.invalidateQueries({ queryKey: ['crm', 'dashboard'] });
      qc.invalidateQueries({ queryKey: ['post-sale'] });
    },
  });
}

/** Remove várias negociações do Funil de Vendas de uma vez — o Lead de origem não é apagado. */
export function useRemoveDeals() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => (await api.delete<{ removed: number }>('/crm/deals', { data: { ids } })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'deals'] }),
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

/** Lista de tarefas/atividades sem exigir um lead/negócio — usada na tela "Tarefas". */
export function useTasks(params: { assignedToId?: string } = {}) {
  return useQuery({
    queryKey: ['crm', 'activities', 'tasks', params],
    queryFn: async () => (await api.get<Activity[]>('/crm/activities', { params })).data,
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
