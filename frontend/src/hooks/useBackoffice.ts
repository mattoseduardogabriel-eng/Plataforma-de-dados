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

export function useDecideOrganizationApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      decision,
      trialDays,
      rejectionReason,
    }: {
      id: string;
      decision: 'APPROVE' | 'REJECT';
      trialDays?: number;
      rejectionReason?: string;
    }) => (await api.patch(`/backoffice/organizations/${id}/approval`, { decision, trialDays, rejectionReason })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backoffice', 'organizations'] }),
  });
}

export interface UpdateSubscriptionPayload {
  subscriptionStatus: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';
  subscriptionPlan?: string;
  subscriptionPriceCents?: number;
  nextBillingAt?: string;
  trialEndsAt?: string;
}

export function useSetOrganizationFeatures() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, enabledFeatures }: { id: string; enabledFeatures: string[] }) =>
      (await api.patch(`/backoffice/organizations/${id}/features`, { enabledFeatures })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backoffice', 'organizations'] }),
  });
}

export function useUpdateOrganizationSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & UpdateSubscriptionPayload) =>
      (await api.patch(`/backoffice/organizations/${id}/subscription`, payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backoffice', 'organizations'] }),
  });
}
