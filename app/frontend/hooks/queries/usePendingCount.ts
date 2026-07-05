import { useQuery } from '@tanstack/react-query';

import { authApi } from '@/lib/apiRequests';
import { qk } from '@/lib/queryKeys';

/**
 * Счётчик заявок для badge в шапке (только сотрудники).
 * Заменяет ручной setInterval-поллинг из AuthContext: интервал 15с,
 * пауза на скрытой вкладке и рефетч при возврате — из коробки TanStack Query.
 */
export function usePendingCount(enabled: boolean) {
  return useQuery({
    queryKey: qk.pendingCount,
    queryFn: () => authApi.getPendingCount().then((r) => r.data.pending_docs_count),
    enabled,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
}
