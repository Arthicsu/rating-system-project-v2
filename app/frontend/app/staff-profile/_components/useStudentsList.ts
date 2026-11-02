'use client';

import { useEffect, useMemo } from 'react';

import toast from '@/lib/toast';
import { useCategories, useRating } from '@/hooks/queries';
import type { PeriodParams, StaffFilters } from '@/hooks/useStaffFilters';
import { apiErrorMessage, isAuthError } from '@/lib/apiError';
import type { RatingParams, Tab } from '@/interfaces/RatingInterfaces';
import type Student from '@/interfaces/StudentInterfaces';

/** Вкладка «Студенты»: подвкладки категорий, категория с запасным «общим рейтингом» и запрос рейтинга. */
export function useStudentsList({
  pickedCategory,
  direction,
  page: currentPage,
  pageSize,
  search: groupSearchValue,
  groupId,
  periodParams,
  filterParams,
  ready,
}: {
  pickedCategory: string;
  direction: 'asc' | 'desc';
  page: number;
  pageSize: number;
  search: string;
  groupId: string;
  periodParams: PeriodParams;
  filterParams: StaffFilters['filterParams'];
  ready: boolean;
}) {
  // Подвкладки категорий рейтинга («Общий рейтинг» + категории достижений).
  const { data: categoriesData, error: categoriesError } = useCategories();
  useEffect(() => {
    if (categoriesError && !isAuthError(categoriesError)) {
      toast.error(apiErrorMessage(categoriesError, 'Не удалось загрузить категории достижений'));
    }
  }, [categoriesError]);

  const categoryTabs = useMemo<Tab[]>(
    () => [
      { id: 'common', label: 'Общий рейтинг' },
      ...(categoriesData ?? []).map((cat) => ({ id: cat.code, label: cat.label })),
    ],
    [categoriesData]
  );

  // Категория из адреса могла устареть (удалили в админке) — тогда общий рейтинг, а не NaN в баллах.
  const category =
    categoriesData && !categoriesData.some((c) => c.code === pickedCategory) ? 'common' : pickedCategory;
  const scoreKey = category === 'common' ? 'total_score' : `${category}_score`;

  // Таблица студентов — ручка рейтинга: период из фильтров кабинета,
  // категория/направление сортировки и поиск по ФИО/зачётке.
  const ratingParams = useMemo<RatingParams>(
    () => ({
      category,
      direction,
      page: currentPage,
      page_size: pageSize,
      search: groupSearchValue || undefined,
      ...periodParams,
      group_id: groupId,
      ...filterParams,
    }),
    [category, direction, currentPage, pageSize, groupSearchValue, periodParams, groupId, filterParams]
  );

  const studentsQuery = useRating(ratingParams, ready);
  const studentsData = (studentsQuery.data?.results ?? []) as Student[];
  const totalStudents = studentsQuery.data?.count ?? 0;
  // Как раньше: индикатор при первой загрузке и смене параметров, но не при фоновом поллинге.
  const studentsLoading = studentsQuery.isPending || studentsQuery.isPlaceholderData;

  return {
    categoryTabs,
    category,
    scoreKey,
    query: studentsQuery,
    students: studentsData,
    total: totalStudents,
    loading: studentsLoading,
  };
}
