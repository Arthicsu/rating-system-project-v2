import { useQuery } from '@tanstack/react-query';

import { studentApi } from '@/lib/apiRequests';
import { qk } from '@/lib/queryKeys';

export function useAchievementConfig() {
  return useQuery({
    queryKey: qk.achievementConfig,
    queryFn: () => studentApi.getAchievementConfig().then((r) => r.data),
    // Конфиг меняется редко и закэширован на backend на час.
    staleTime: 60 * 60_000,
  });
}
