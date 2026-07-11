import { useQuery } from '@tanstack/react-query';

import { universityApi, userApi } from '@/lib/apiRequests';
import { qk } from '@/lib/queryKeys';

// Справочники: закэшированы и на backend (cache_page), и здесь — подольше.
const LOOKUP_STALE_TIME = 5 * 60_000;

export function useCategories() {
  return useQuery({
    queryKey: qk.categories,
    queryFn: () => userApi.getCategoryAchievements().then((r) => r.data),
    staleTime: LOOKUP_STALE_TIME,
  });
}

export function useRatingFilters() {
  return useQuery({
    queryKey: qk.ratingFilters,
    queryFn: () => userApi.getRatingFilters().then((r) => r.data),
    staleTime: LOOKUP_STALE_TIME,
  });
}

// Справочники ниже — staff-ручки (IsStaffProfile): для студента запрос не
// выполняется вовсе (enabled=false), а не завершается 403.

export function useRejectionReasons(enabled = true) {
  return useQuery({
    queryKey: qk.rejectionReasons,
    queryFn: () => universityApi.getRejectionReasons().then((r) => r.data),
    staleTime: LOOKUP_STALE_TIME,
    enabled,
  });
}

export function useAcademicYears(enabled = true) {
  return useQuery({
    queryKey: qk.academicYears,
    queryFn: () => universityApi.getAcademicYears().then((r) => r.data),
    staleTime: LOOKUP_STALE_TIME,
    enabled,
  });
}
