import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';

import { studentApi } from '@/lib/apiRequests';
import { qk } from '@/lib/queryKeys';

/**
 * Мутации достижений студента (создание/правка/удаление) в одном месте.
 * После успеха инвалидируется всё, на что влияет изменение достижения:
 * профиль (списки заявок и баллы), дашборд сотрудника, открытая страница
 * достижения и счётчик заявок в шапке.
 */
function useInvalidateAchievements() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: qk.profileAll });
    queryClient.invalidateQueries({ queryKey: qk.dashboardAll });
    queryClient.invalidateQueries({ queryKey: qk.achievementAll });
    queryClient.invalidateQueries({ queryKey: qk.pendingCount });
  };
}

export function useUploadAchievement() {
  const invalidate = useInvalidateAchievements();
  return useMutation({
    mutationFn: ({ formData, idempotencyKey }: { formData: FormData; idempotencyKey: string }) =>
      studentApi.uploadAchievement(formData, idempotencyKey).then((r) => r.data),
    onSuccess: invalidate,
    onError: (error) => {
      // 409: сервер уже принял эту отправку (ретрай после сетевого сбоя) -
      // кэш освежаем как при успехе, чтобы достижение появилось в профиле.
      if ((error as AxiosError).response?.status === 409) invalidate();
    },
  });
}

export function useUpdateAchievement() {
  const invalidate = useInvalidateAchievements();
  return useMutation({
    mutationFn: ({ id, formData }: { id: number; formData: FormData }) =>
      studentApi.updateAchievement(id, formData).then((r) => r.data),
    onSuccess: invalidate,
  });
}

export function useDeleteAchievement() {
  const invalidate = useInvalidateAchievements();
  return useMutation({
    mutationFn: (id: number) => studentApi.deleteAchievement(id).then((r) => r.data),
    onSuccess: invalidate,
  });
}
