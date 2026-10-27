/**
 * Типизированный слой поверх сгенерированных OpenAPI-типов.
 *
 * lib/api-types.ts ГЕНЕРИРУЕТСЯ из schema.yml (источник — drf-spectacular backend):
 *   pnpm generate:api   — перегенерировать после изменения serializers/views;
 *   pnpm check:api-sync — проверка синхронности (гоняется в docker build --target check).
 *
 * Здесь — короткие алиасы DTO и составные типы для ответов, в которые backend
 * добавляет поля вне сериализаторов (radar_stats, stats/top5 и т.п.).
 */
import type { components } from '@/lib/api-types';

export type ApiSchema<T extends keyof components['schemas']> = components['schemas'][T];

/** Стандартная пагинация DRF: {count, next, previous, results} + номер отданной страницы. */
export interface Paginated<T> {
  count: number;
  /** Номер отданной страницы: вместо несуществующей сервер отдаёт последнюю (core/pagination). */
  page: number;
  next?: string | null;
  previous?: string | null;
  results: T[];
}

// --- Прямые алиасы DTO ------------------------------------------------------

export type UserResponseDto = ApiSchema<'UserResponse'>;
export type StudentProfileDto = ApiSchema<'StudentProfile'>;
export type StudentRatingDto = ApiSchema<'StudentRating'>;
export type DocumentDto = ApiSchema<'Document'>;
export type PendingDocumentDto = ApiSchema<'PendingDocument'>;
export type DocumentFileDto = ApiSchema<'DocumentFile'>;
export type SemesterScoreDto = ApiSchema<'SemesterScore'>;
export type GroupDto = ApiSchema<'Group'>;
export type GroupFilterDto = ApiSchema<'GroupFilter'>;
export type FacultyFilterDto = ApiSchema<'FacultyFilter'>;
export type AcademicYearDto = ApiSchema<'AcademicYear'>;
export type RejectionReasonDto = ApiSchema<'RejectionReason'>;
export type CategoryDto = ApiSchema<'Category'>;
export type RatingFiltersResponseDto = ApiSchema<'RatingFiltersResponse'>;
export type StaffProfileResponseDto = ApiSchema<'StaffProfileResponse'>;
export type ReviewDocumentRequestDto = ApiSchema<'ReviewDocumentRequest'>;
export type PendingCountDto = ApiSchema<'PendingCount'>;
export type PastPendingDto = ApiSchema<'PastPending'>;
export type MessageDto = ApiSchema<'Message'>;
export type ChangePasswordDto = ApiSchema<'ChangePassword'>;
export type NotificationSettingsDto = ApiSchema<'NotificationSettings'>;
export type ErrorDetailDto = ApiSchema<'ErrorDetail'>;
export type LoginRequestDto = ApiSchema<'LoginRequest'>;

// --- Составные типы ответов -------------------------------------------------
// Поля, которые backend добавляет к сериализованным данным вручную
// (см. core/querysets.py student_full_profile, AchievementViewSet.list).

/** Пользователь сессии; message приходит в ответах login, pending_docs_count кладёт фронт из notifications. */
export type AuthUser = UserResponseDto & {
  message?: string;
  pending_docs_count?: number;
};

/** Полный профиль студента: StudentProfile + radar_stats/is_own_profile/контакты. */
export type Profile = StudentProfileDto & {
  radar_stats: { labels: string[]; data: number[] };
  is_own_profile: boolean;
  phone?: string | null;
};

/** Строка top5 дашборда (контракт StudentSimple). */
export interface StudentSimple {
  id: number;
  full_name: string;
  total_score: number;
}

/** Ход модерации за период (core/querysets._moderation_stats). */
export interface ModerationStats {
  submitted: number;
  approved: number;
  rejected: number;
  /** Ждут решения кафедры; returned — из них с причиной (повторные и возвращённые). */
  pending: number;
  returned: number;
  /** Сколько дней ждёт самая старая заявка на рассмотрении; null — таких нет. */
  oldest_pending_days: number | null;
}

/** Блок stats дашборда; categories — суммы по кодам категорий. */
export interface DashboardStats {
  total_students: number;
  avg_score: number;
  max_score: number;
  min_score: number;
  categories: Record<string, number>;
  moderation: ModerationStats;
}

/** GET /api/v1/achievements/ (staff): пагинированные заявки + stats + top5. */
export type DashboardStatsResponse = Paginated<PendingDocumentDto> & {
  stats: DashboardStats;
  top5: StudentSimple[];
};
