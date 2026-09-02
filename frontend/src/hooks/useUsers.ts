import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { User } from '@/types';

export function useOrgUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get<User[]>('/users')).data,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => (await api.post('/users', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Record<string, unknown>) =>
      (await api.patch(`/users/${id}`, payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useOrganization() {
  return useQuery({
    queryKey: ['organization'],
    queryFn: async () => (await api.get('/organizations/me')).data,
  });
}

export function useUpdateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => (await api.patch('/organizations/me', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organization'] }),
  });
}

export function useConfirmSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post('/organizations/me/subscription/confirm')).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organization'] }),
  });
}
