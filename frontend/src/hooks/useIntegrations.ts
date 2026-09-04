import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  LiroCrmBackfillTasksResult,
  LiroCrmStatus,
  LiroCrmSyncResult,
  LiroKanbanStage,
  PersonalDataProviderStatus,
  SavePersonalDataProviderPayload,
} from '@/types';

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

// "Sincronizar tarefas agora" — cobre tarefa de antes da integração
// conectar, ou uma sincronização individual que falhou e nunca
// reprocessou sozinha (ver LiroCrmService.backfillTasks no backend).
export function useBackfillLiroCrmTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post<LiroCrmBackfillTasksResult>('/integrations/liro-crm/tasks/backfill')).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'activities'] }),
  });
}

export function usePushLiroCrmTag() {
  return useMutation({
    mutationFn: async ({ leadId, tagName }: { leadId: string; tagName: string }) =>
      (await api.post<{ success: boolean }>(`/integrations/liro-crm/leads/${leadId}/tags`, { tagName })).data,
  });
}

// "Adicionar ao Funil de Vendas" manual — pra lead que nunca teve negócio,
// ou que saiu do funil (ex.: conversa excluída no Liro CRM) e a pessoa
// quer colocar de volta quando quiser.
export function useAddLeadToFunnel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (leadId: string) => (await api.post(`/integrations/liro-crm/leads/${leadId}/add-to-funnel`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'leads'] });
      qc.invalidateQueries({ queryKey: ['crm', 'deals'] });
    },
  });
}

// Etapas do Kanban do Liro CRM, pra montar a tela de mapeamento de funil
// (qual etapa de lá corresponde a qual etapa do Aster). Só faz sentido
// chamar com a integração já conectada — ver LiroCrmIntegrationCard.
export function useLiroCrmKanbanStages(enabled: boolean) {
  return useQuery({
    queryKey: ['integrations', 'liro-crm', 'kanban-stages'],
    queryFn: async () => (await api.get<LiroKanbanStage[]>('/integrations/liro-crm/kanban-stages')).data,
    enabled,
  });
}

export function useSetLiroCrmStageMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      pipelineStageId,
      liroKanbanStageId,
      liroKanbanStageName,
    }: {
      pipelineStageId: string;
      liroKanbanStageId: string | null;
      liroKanbanStageName: string | null;
    }) =>
      (
        await api.put(`/integrations/liro-crm/pipeline-stages/${pipelineStageId}/mapping`, {
          liroKanbanStageId,
          liroKanbanStageName,
        })
      ).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'pipelines'] }),
  });
}

export function usePersonalDataProviderStatus() {
  return useQuery({
    queryKey: ['integrations', 'personal-data-provider'],
    queryFn: async () => (await api.get<PersonalDataProviderStatus>('/integrations/personal-data-provider')).data,
  });
}

export function useSavePersonalDataProviderConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SavePersonalDataProviderPayload) =>
      (await api.put<PersonalDataProviderStatus>('/integrations/personal-data-provider', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations', 'personal-data-provider'] }),
  });
}

export function useRemovePersonalDataProviderConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.delete<PersonalDataProviderStatus>('/integrations/personal-data-provider')).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations', 'personal-data-provider'] }),
  });
}

export function useTestPersonalDataProviderConnection() {
  return useMutation({
    mutationFn: async () =>
      (await api.post<{ success: boolean; testedKind: string }>('/integrations/personal-data-provider/test')).data,
  });
}
