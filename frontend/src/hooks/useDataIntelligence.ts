import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { DataProviderResult, DataQueryHistoryItem, DataQueryType } from '@/types';

const ENDPOINTS: Record<'cnpj' | 'cpf' | 'phone' | 'credit-score' | 'relatives', string> = {
  cnpj: '/data-intelligence/cnpj/query',
  cpf: '/data-intelligence/cpf/query',
  phone: '/data-intelligence/phone/query',
  'credit-score': '/data-intelligence/credit-score/query',
  relatives: '/data-intelligence/relatives/query',
};

export function useDataQuery(kind: keyof typeof ENDPOINTS) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { document?: string; phone?: string; purpose: string }) =>
      (await api.post<DataProviderResult>(ENDPOINTS[kind], payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['data-intelligence', 'history'] }),
  });
}

export function useDataQueryHistory(
  params: {
    type?: DataQueryType;
    targetDocument?: string;
    dataInicio?: string;
    dataFim?: string;
    purpose?: string;
    requestedById?: string;
    skip?: number;
    take?: number;
  } = {},
) {
  return useQuery({
    queryKey: ['data-intelligence', 'history', params],
    queryFn: async () =>
      (await api.get<{ items: DataQueryHistoryItem[]; total: number }>('/data-intelligence/history', { params }))
        .data,
  });
}
