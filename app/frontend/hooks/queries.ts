import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';

import { authApi, studentApi, universityApi, userApi } from '@/lib/apiRequests';
import { qk } from '@/lib/queryKeys';
import type { ReviewDocumentRequestDto } from '@/lib/api';
import type { FilterParams, RatingParams } from '@/interfaces/RatingInterfaces';
import type { DashboardStatsParams, FilterStudentsParams } from '@/interfaces/StaffInterfaces';

// Все query/mutation-хуки TanStack Query в одном файле: каждый — 10 строк
// обвязки вокруг lib/apiRequests, отдельные файлы им ни к чему.

// --- Профиль и достижения студента -----------------------------------------

export function useMyProfile() {
  return useQuery({
    queryKey: qk.profile(),
    queryFn: () => studentApi.getProfile().then((r) => r.data),
  });
}

export function useProfileById(id: string) {
  return useQuery({
    queryKey: qk.profile(id),
    queryFn: () => studentApi.getProfileById(id).then((r) => r.data),
    enabled: !!id,
  });
}

export function useAchievement(id: string) {
  return useQuery({
    queryKey: qk.achievement(id),
    queryFn: () => studentApi.getAchievementDetail(id).then((r) => r.data),
    enabled: !!id,
    // 403/404 — валидные исходы (нет доступа/нет заявки), без повторов.
    retry: false,
  });
}

export function useAchievementConfig() {
  return useQuery({
    queryKey: qk.achievementConfig,
    queryFn: () => studentApi.getAchievementConfig().then((r) => r.data),
    // Конфиг меняется редко и закэширован на backend на час.
    staleTime: 60 * 60_000,
  });
}

// --- Справочники ------------------------------------------------------------
// Закэшированы и на backend (cache_page), и здесь — подольше.

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

/** Группы, доступные сотруднику (scope backend), с фильтрами по курсу/факультету. */
export function useGroups(params: FilterParams, enabled = true) {
  return useQuery({
    queryKey: qk.groups(params),
    queryFn: () => universityApi.getFilteredGroups(params).then((r) => r.data),
    // Staff-ручка: для студента запрос не выполняется (а не 403).
    enabled,
  });
}

// --- Рейтинг и кабинет сотрудника -------------------------------------------

export function useRating(params: RatingParams, enabled = true) {
  return useQuery({
    queryKey: qk.rating(params),
    queryFn: () => userApi.getRating(params).then((r) => r.data),
    // При смене страницы/фильтра показываем прежние строки (существующий UX opacity-40).
    placeholderData: keepPreviousData,
    // Staff-ручка: пока фильтры кабинета не готовы (нет семестра) — не запрашиваем.
    enabled,
  });
}

/** Список студентов сотрудника (вкладка «Группа» staff-профиля). */
export function useStudents(params: FilterStudentsParams, enabled = true) {
  return useQuery({
    queryKey: qk.students(params),
    queryFn: () => universityApi.getFilteredStudents(params).then((r) => r.data),
    placeholderData: keepPreviousData,
    enabled,
  });
}

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
