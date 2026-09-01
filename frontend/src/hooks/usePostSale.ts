import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Customer, CustomerFieldDefinition, CustomFieldType, PortfolioOverview } from '@/types';

export interface CustomerListParams {
  name?: string;
  document?: string;
  city?: string;
  planName?: string;
  status?: string[];
  churnRiskLevel?: string[];
  /** { [chave do campo personalizado]: string | boolean } */
  customFields?: Record<string, string | boolean>;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export function useCustomers(params: CustomerListParams = {}) {
  const query = {
    name: params.name || undefined,
    document: params.document || undefined,
    city: params.city || undefined,
    planName: params.planName || undefined,
    status: params.status?.length ? params.status.join(',') : undefined,
    churnRiskLevel: params.churnRiskLevel?.length ? params.churnRiskLevel.join(',') : undefined,
    customFields: params.customFields && Object.keys(params.customFields).length ? JSON.stringify(params.customFields) : undefined,
    sortBy: params.sortBy || undefined,
    sortDir: params.sortDir || undefined,
  };
  return useQuery({
    queryKey: ['post-sale', 'customers', query],
    queryFn: async () => (await api.get<Customer[]>('/post-sale/customers', { params: query })).data,
  });
}

export function useCustomerFieldDefinitions() {
  return useQuery({
    queryKey: ['post-sale', 'customer-fields'],
    queryFn: async () => (await api.get<CustomerFieldDefinition[]>('/post-sale/customer-fields')).data,
  });
}

export function useCreateCustomerFieldDefinition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { label: string; type: CustomFieldType; options?: string[] }) =>
      (await api.post<CustomerFieldDefinition>('/post-sale/customer-fields', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['post-sale', 'customer-fields'] }),
  });
}

export function useDeleteCustomerFieldDefinition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/post-sale/customer-fields/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['post-sale', 'customer-fields'] });
      qc.invalidateQueries({ queryKey: ['post-sale', 'customers'] });
    },
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

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Record<string, unknown>) =>
      (await api.patch(`/post-sale/customers/${id}`, payload)).data,
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['post-sale', 'customers'] });
      qc.invalidateQueries({ queryKey: ['post-sale', 'customers', variables.id] });
    },
  });
}

export interface ImportCustomersResult {
  created: number;
  updated: number;
  errors: { row: number; name?: string; message: string }[];
}

export function useImportCustomers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (customers: Record<string, unknown>[]) =>
      (await api.post<ImportCustomersResult>('/post-sale/customers/import', { customers })).data,
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
