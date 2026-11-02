'use client';

import { useMemo } from 'react';

import { useDashboard } from '@/hooks/queries';
import type { PeriodParams, StaffFilters } from '@/hooks/useStaffFilters';
import type { DashboardStats, DashboardStatsParams } from '@/interfaces/StaffInterfaces';

const EMPTY_STATS: DashboardStats = {
  total_students: 0, avg_score: 0, max_score: 0, min_score: 0, categories: {},
  moderation: { submitted: 0, approved: 0, rejected: 0, pending: 0, returned: 0, oldest_pending_days: null },
};

/** Заявки на рассмотрение: весь список (счётчик, статистика, топ-5) и список под поиском или фильтром. */
export function usePendingLists({
  groupId,
  periodParams,
  filterParams,
  page: requestsPage,
  pageSize: requestsPageSize,
  stateFilter: pendingStateFilter,
  search: pendingSearchValue,
  ready,
}: {
  groupId: string;
  periodParams: PeriodParams;
  filterParams: StaffFilters['filterParams'];
  page: number;
  pageSize: number;
  stateFilter?: DashboardStatsParams['state'];
  search: string;
  ready: boolean;
}) {
  const pendingParams = useMemo<DashboardStatsParams>(
    () => ({
      group_id: groupId,
      ...periodParams,
      page: requestsPage,
      page_size: requestsPageSize,
      ...filterParams,
    }),
    [groupId, periodParams, requestsPage, requestsPageSize, filterParams]
  );

  // Поллинг 15с заменяет прежний ручной setInterval: заявки появляются/исчезают
  // без перезагрузки, пауза на скрытой вкладке.
  const pendingQuery = useDashboard(pendingParams, { enabled: ready, pollMs: 15_000 });
  // Список под поиском или фильтром «Новые/Повторные» (таблетки только у кафедры) - отдельный
  // запрос: счётчик вкладки, статистика и топ-5 остаются по всем заявкам (pendingQuery без них).
  const pendingFiltered = !!pendingStateFilter || !!pendingSearchValue;
  const filteredPendingQuery = useDashboard(
    { ...pendingParams, state: pendingStateFilter, search: pendingSearchValue || undefined },
    { enabled: ready && pendingFiltered, pollMs: 15_000 },
  );
  const pendingListQuery = pendingFiltered ? filteredPendingQuery : pendingQuery;
  const pendingDocsData = pendingListQuery.data?.results ?? [];
  const pendingListCount = pendingListQuery.data?.count ?? 0;
  const totalRequests = pendingQuery.data?.count ?? 0;
  const stats = pendingQuery.data?.stats ?? EMPTY_STATS;
  const top5Students = pendingQuery.data?.top5 ?? [];
  const pendingLoading = pendingListQuery.isPending || pendingListQuery.isPlaceholderData;

  return {
    pendingQuery,
    listQuery: pendingListQuery,
    docs: pendingDocsData,
    listCount: pendingListCount,
    totalRequests,
    stats,
    top5: top5Students,
    loading: pendingLoading,
  };
}
