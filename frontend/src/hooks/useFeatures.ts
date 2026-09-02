import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { PlatformFeatureDef } from '@/lib/platform-features';

/** O que o usuário logado enxerga de fato (teto da empresa − bloqueios de setor/usuário). */
export function useEffectiveFeatures() {
  return useQuery({
    queryKey: ['features', 'effective'],
    queryFn: async () => (await api.get<{ features: string[] }>('/organizations/me/features/effective')).data.features,
    staleTime: 60_000,
  });
}

export interface FeatureConfigSector {
  id: string;
  name: string;
  disabledFeatures: string[];
}
export interface FeatureConfigUser {
  id: string;
  name: string;
  email: string;
  role: string;
  sectorId: string | null;
  disabledFeatures: string[];
}
export interface FeatureConfig {
  catalog: PlatformFeatureDef[];
  enabledFeatures: string[];
  sectors: FeatureConfigSector[];
  users: FeatureConfigUser[];
}

/** Visão completa pro ADMIN/GESTOR: teto da empresa + bloqueios por setor/usuário. */
export function useFeatureConfig() {
  return useQuery({
    queryKey: ['features', 'config'],
    queryFn: async () => (await api.get<FeatureConfig>('/organizations/me/features')).data,
  });
}

export function useSetSectorFeatures() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sectorId, disabledFeatures }: { sectorId: string; disabledFeatures: string[] }) =>
      (await api.patch(`/organizations/me/features/sectors/${sectorId}`, { disabledFeatures })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['features'] }),
  });
}

export function useSetUserFeatures() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, disabledFeatures }: { userId: string; disabledFeatures: string[] }) =>
      (await api.patch(`/organizations/me/features/users/${userId}`, { disabledFeatures })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['features'] }),
  });
}
