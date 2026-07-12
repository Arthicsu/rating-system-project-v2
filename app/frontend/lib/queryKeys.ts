import type { RatingParams, FilterParams } from '@/interfaces/RatingInterfaces';
import type { DashboardStatsParams, FilterStudentsParams } from '@/interfaces/StaffInterfaces';

/**
 * Фабрика ключей TanStack Query — единственный источник имён кэша.
 * Параметризованные ключи включают объект параметров целиком:
 * смена любого фильтра = другой ключ = отдельная запись кэша.
 */
export const qk = {
  pendingCount: ['pending-count'] as const,
  categories: ['categories'] as const,
  ratingFilters: ['rating-filters'] as const,
  achievementConfig: ['achievement-config'] as const,
  rejectionReasons: ['rejection-reasons'] as const,
  academicYears: ['academic-years'] as const,

  // Префиксы для инвалидации: накрывают все параметризованные ключи семейства
  // (например, profileAll инвалидирует и ['profile','me'], и ['profile','<id>']).
  profileAll: ['profile'] as const,
  achievementAll: ['achievement'] as const,
  dashboardAll: ['dashboard'] as const,
  studentsAll: ['students'] as const,
  ratingAll: ['rating'] as const,

  rating: (params: RatingParams) => ['rating', params] as const,
  profile: (id?: string) => ['profile', id ?? 'me'] as const,
  achievement: (id: string | number) => ['achievement', String(id)] as const,
  groups: (params?: FilterParams) => ['groups', params ?? {}] as const,
  students: (params: FilterStudentsParams) => ['students', params] as const,
  dashboard: (params: DashboardStatsParams) => ['dashboard', params] as const,
};
