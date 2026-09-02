import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { BackofficeOrganization, BackofficeOrganizationDetail } from '@/types';

export function useBackofficeOrganizations() {
  return useQuery({
    queryKey: ['backoffice', 'organizations'],
    queryFn: async () => (await api.get<BackofficeOrganization[]>('/backoffice/organizations')).data,
  });
}

export function useBackofficeOrganization(id?: string) {
  return useQuery({
    queryKey: ['backoffice', 'organizations', id],
    queryFn: async () => (await api.get<BackofficeOrganizationDetail>(`/backoffice/organizations/${id}`)).data,
    enabled: !!id,
  });
}

export interface CreateOrganizationPayload {
  organizationName: string;
  organizationCnpj?: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}

export function useCreateBackofficeOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateOrganizationPayload) =>
      (await api.post<BackofficeOrganizationDetail>('/backoffice/organizations', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backoffice', 'organizations'] }),
  });
}

export function useSetOrganizationStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) =>
      (await api.patch(`/backoffice/organizations/${id}/status`, { active })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backoffice', 'organizations'] }),
  });
}
