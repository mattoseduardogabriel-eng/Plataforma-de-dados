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

export interface TransactionListParams {
  type?: string[];
  status?: string[];
  categoryId?: string[];
  description?: string;
  from?: string;
  to?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export function useTransactions(params: TransactionListParams = {}) {
  const query = {
    type: params.type?.length ? params.type.join(',') : undefined,
    status: params.status?.length ? params.status.join(',') : undefined,
    categoryId: params.categoryId?.length ? params.categoryId.join(',') : undefined,
    description: params.description || undefined,
    from: params.from || undefined,
    to: params.to || undefined,
    sortBy: params.sortBy || undefined,
    sortDir: params.sortDir || undefined,
  };
  return useQuery({
    queryKey: ['financial', 'transactions', query],
    queryFn: async () => (await api.get<Transaction[]>('/financial/transactions', { params: query })).data,
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
