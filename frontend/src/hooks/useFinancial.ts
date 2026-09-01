import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CashFlowPoint, CashFlowSummary, Category, Transaction } from '@/types';

export function useCategories() {
  return useQuery({
    queryKey: ['financial', 'categories'],
    queryFn: async () => (await api.get<Category[]>('/financial/categories')).data,
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; type: 'RECEITA' | 'DESPESA' }) =>
      (await api.post('/financial/categories', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['financial', 'categories'] }),
  });
}

export function useTransactions(params: { type?: string; status?: string; from?: string; to?: string } = {}) {
  return useQuery({
    queryKey: ['financial', 'transactions', params],
    queryFn: async () => (await api.get<Transaction[]>('/financial/transactions', { params })).data,
  });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => (await api.post('/financial/transactions', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financial'] });
    },
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Record<string, unknown>) =>
      (await api.patch(`/financial/transactions/${id}`, payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['financial'] }),
  });
}

export function useCashFlow(months = 6) {
  return useQuery({
    queryKey: ['financial', 'cash-flow', months],
    queryFn: async () =>
      (await api.get<{ series: CashFlowPoint[]; summary: CashFlowSummary }>('/financial/dashboard/cash-flow', {
        params: { months },
      })).data,
  });
}
