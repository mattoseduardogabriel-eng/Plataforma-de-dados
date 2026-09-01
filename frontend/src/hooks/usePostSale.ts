import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Customer, PortfolioOverview } from '@/types';

export function useCustomers(params: { status?: string; churnRiskLevel?: string; search?: string } = {}) {
  return useQuery({
    queryKey: ['post-sale', 'customers', params],
    queryFn: async () => (await api.get<Customer[]>('/post-sale/customers', { params })).data,
  });
}

export function useCustomer(id?: string) {
  return useQuery({
    queryKey: ['post-sale', 'customers', id],
    queryFn: async () => (await api.get(`/post-sale/customers/${id}`)).data,
    enabled: !!id,
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => (await api.post('/post-sale/customers', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['post-sale', 'customers'] }),
  });
}

export function useCreateContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => (await api.post('/post-sale/contracts', payload)).data,
    onSuccess: (_data, variables: any) =>
      qc.invalidateQueries({ queryKey: ['post-sale', 'customers', variables.customerId] }),
  });
}

export function useCreateInteraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => (await api.post('/post-sale/interactions', payload)).data,
    onSuccess: (_data, variables: any) =>
      qc.invalidateQueries({ queryKey: ['post-sale', 'customers', variables.customerId] }),
  });
}

export function useRecordChurnSignal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => (await api.post('/post-sale/churn-signals', payload)).data,
    onSuccess: (_data, variables: any) => {
      qc.invalidateQueries({ queryKey: ['post-sale', 'customers', variables.customerId] });
      qc.invalidateQueries({ queryKey: ['post-sale', 'customers'] });
      qc.invalidateQueries({ queryKey: ['post-sale', 'portfolio'] });
    },
  });
}

export function usePortfolioOverview() {
  return useQuery({
    queryKey: ['post-sale', 'portfolio'],
    queryFn: async () => (await api.get<PortfolioOverview>('/post-sale/dashboard/portfolio')).data,
  });
}
