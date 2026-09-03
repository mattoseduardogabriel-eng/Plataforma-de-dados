import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AuditLogItem, Report } from '@/types';

export function useReports() {
  return useQuery({
    queryKey: ['reports'],
    queryFn: async () => (await api.get<Report[]>('/reports')).data,
  });
}

export function useReport(id?: string) {
  return useQuery({
    queryKey: ['reports', id],
    queryFn: async () => (await api.get<Report>(`/reports/${id}`)).data,
    enabled: !!id,
  });
}

export function useGenerateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { targetDocument: string; targetType: 'CNPJ' | 'CPF'; purpose: string; title?: string }) =>
      (await api.post<Report>('/reports', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports'] }),
  });
}

export function useAuditLogs(params: { entityType?: string; from?: string; to?: string } = {}) {
  return useQuery({
    queryKey: ['audit-logs', params],
    queryFn: async () =>
      (await api.get<{ items: AuditLogItem[]; total: number }>('/audit-logs', { params: { ...params, take: 100 } }))
        .data,
  });
}
