import { useQuery } from '@tanstack/react-query';

import { studentApi } from '@/lib/apiRequests';
import { qk } from '@/lib/queryKeys';

export function useAchievement(id: string) {
  return useQuery({
    queryKey: qk.achievement(id),
    queryFn: () => studentApi.getAchievementDetail(id).then((r) => r.data),
    enabled: !!id,
    // 403/404 — валидные исходы (нет доступа/нет заявки), без повторов.
    retry: false,
  });
}
