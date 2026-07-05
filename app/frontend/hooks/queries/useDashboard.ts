import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { universityApi } from '@/lib/apiRequests';
import { qk } from '@/lib/queryKeys';
import type { DashboardStatsParams } from '@/interfaces/StaffInterfaces';

/**
 * Заявки + stats + top5 (GET /api/v1/achievements/ для сотрудника).
 *
 * refetchInterval у pending-списка заменяет прежний ручной setInterval-поллинг:
 * заявки появляются/исчезают без перезагрузки, пауза на скрытой вкладке.
 */
export function useDashboard(
  params: DashboardStatsParams,
  options?: { enabled?: boolean; pollMs?: number }
) {
  return useQuery({
    queryKey: qk.dashboard(params),
    queryFn: () => universityApi.getFilteredDashboardStats(params).then((r) => r.data),
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
    refetchInterval: options?.pollMs,
    refetchIntervalInBackground: false,
  });
}
