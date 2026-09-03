import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useChangePassword() {
  return useMutation({
    mutationFn: async (payload: { currentPassword: string; newPassword: string }) =>
      (await api.post('/auth/change-password', payload)).data,
  });
}
