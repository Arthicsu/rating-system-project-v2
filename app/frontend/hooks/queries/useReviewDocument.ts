import { useMutation, useQueryClient } from '@tanstack/react-query';

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

  return useMutation({
    mutationFn: ({ documentId, data }: { documentId: number; data: ReviewDocumentRequestDto }) =>
      universityApi.reviewDocument(documentId, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.dashboardAll });
      queryClient.invalidateQueries({ queryKey: qk.studentsAll });
      queryClient.invalidateQueries({ queryKey: qk.ratingAll });
      queryClient.invalidateQueries({ queryKey: qk.profileAll });
      queryClient.invalidateQueries({ queryKey: qk.achievementAll });
      queryClient.invalidateQueries({ queryKey: qk.pendingCount });
    },
  });
}
