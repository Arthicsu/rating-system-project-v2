/**
 * Серверные DTO — из сгенерированных OpenAPI-типов (lib/api.ts);
 * здесь остаются UI-only типы (props, параметры запросов).
 */
import type { RatingFiltersResponseDto } from '@/lib/api';

/** Ответ GET /api/v1/rating/filters/ (faculties/courses/groups — id числовые). */
export type FilterOptions = RatingFiltersResponseDto;

// --- UI-only типы ------------------------------------------------------------

export interface PaginationProps {
  page: number;
  totalCount: number;
  pageSize: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
}

/**
 * Описание одного селекта фильтра рейтинга (факультет/курс/группа).
 * Каскадная логика сбросов живёт в onChange на странице, компоненты
 * панели и шапки таблицы только рендерят конфиг.
 */
export interface RatingFilterConfig {
  id: string;
  label: string;
  value: string;
  disabled?: boolean;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

export interface Tab {
  id: string;
  label: string;
}

export interface CategoryAchievement {
  code: string;
  label: string;
}

export interface Category {
  code: string;
  label: string;
}

export interface RatingParams {
  faculty_id?: string;
  course?: string;
  group_id?: string;
  category: string;
  page: number;
  page_size: number;
}

export interface FilterParams {
  course?: string;
  faculty_id?: string;
}

export interface ExportExcelParams {
  faculty_id?: string;
  course?: string;
  group_id?: string;
  category?: string;
  page?: number;
}
