'use client';

import { useMemo } from 'react';

import { useDashboard } from '@/hooks/queries';
import type { PeriodParams, StaffFilters } from '@/hooks/useStaffFilters';
import type { DashboardStatsParams } from '@/interfaces/StaffInterfaces';

/** Рассмотренные заявки; запрос идёт, только пока открыта их вкладка (enabled). */
export function useReviewedList({
  groupId,
  periodParams,
  filterParams,
  page: reviewedPage,
  pageSize: requestsPageSize,
  search: reviewedSearchValue,
  state: reviewedState,
  enabled,
}: {
  groupId: string;
  periodParams: PeriodParams;
  filterParams: StaffFilters['filterParams'];
  page: number;
  pageSize: number;
  search: string;
  state: string;
  enabled: boolean;
}) {
  const reviewedParams = useMemo<DashboardStatsParams>(
    () => ({
      group_id: groupId,
      ...periodParams,
      page: reviewedPage,
      page_size: requestsPageSize,
      search: reviewedSearchValue || undefined,
      list_type: 'reviewed',
      state: reviewedState === 'all' ? undefined : (reviewedState as DashboardStatsParams['state']),
      ...filterParams,
    }),
    [groupId, periodParams, reviewedPage, requestsPageSize, reviewedSearchValue, reviewedState, filterParams]
  );

  const reviewedQuery = useDashboard(reviewedParams, {
    enabled,
  });
  const reviewedDocsData = reviewedQuery.data?.results ?? [];
  const totalReviewed = reviewedQuery.data?.count ?? 0;
  const reviewedLoading = reviewedQuery.isPending || reviewedQuery.isPlaceholderData;

  return { query: reviewedQuery, docs: reviewedDocsData, total: totalReviewed, loading: reviewedLoading };
}
