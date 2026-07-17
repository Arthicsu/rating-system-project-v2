import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';

import { universityApi } from '@/lib/apiRequests';
import { qk } from '@/lib/queryKeys';
import type { ReviewDocumentRequestDto } from '@/lib/api';

/**
 * Решение по заявке (approve/reject). После успеха инвалидирует всё, на что
 * влияет начисление/списание баллов: дашборд, списки студентов, рейтинг,
 * профили и счётчик заявок в шапке.
 */
export function useReviewDocument() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: qk.dashboardAll });
    queryClient.invalidateQueries({ queryKey: qk.studentsAll });
    queryClient.invalidateQueries({ queryKey: qk.ratingAll });
    queryClient.invalidateQueries({ queryKey: qk.profileAll });
    queryClient.invalidateQueries({ queryKey: qk.achievementAll });
    queryClient.invalidateQueries({ queryKey: qk.pendingCount });
  };

  return useMutation({
    mutationFn: ({ documentId, data, idempotencyKey }: { documentId: number; data: ReviewDocumentRequestDto; idempotencyKey: string }) =>
      universityApi.reviewDocument(documentId, data, idempotencyKey).then((r) => r.data),
    onSuccess: invalidate,
    onError: (error) => {
      // 409: решение уже принято этим же ключом (двойной клик) - списки освежаем.
      if ((error as AxiosError).response?.status === 409) invalidate();
    },
  });
}
