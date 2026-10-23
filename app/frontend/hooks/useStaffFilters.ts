'use client';

import { useEffect, useMemo, useState } from 'react';

import { useAcademicYears, useGroups, useRatingFilters } from '@/hooks/queries';
import type { Faculty, Group, Semester } from '@/interfaces/StaffInterfaces';

export interface StaffFilters {
  facultyId: string;
  course: string;
  groupId: string;
  semesterId: number;
  semesterLabel: string;
  facultiesList: Faculty[];
  groupsList: Group[];
  semesterOptions: Semester[];
  /** Смена факультета: сбрасывает курс и группу (прежняя цепочка handleFacultyChange+handleCourseChange('all')+handleGroupChange('all')). */
  changeFaculty: (value: string) => void;
  /** Смена курса: при 'all' сбрасывает группу. */
  changeCourse: (value: string) => void;
  changeGroup: (value: string) => void;
  changeSemester: (id: number) => void;
  /** faculty_id/course для запросов (undefined при 'all'). */
  filterParams: { faculty_id?: string; course?: string };
}

/** Начальные значения фильтров (из адреса страницы); 0 у семестра — текущий. */
export interface StaffFiltersInitial {
  facultyId: string;
  course: string;
  groupId: string;
  semesterId: number;
}

const NO_INITIAL: StaffFiltersInitial = { facultyId: 'all', course: 'all', groupId: 'all', semesterId: 0 };

/**
 * Состояние фильтров staff-профиля: факультет/курс/группа/период с каскадными
 * сбросами. Группы перезапрашиваются реактивно по ключу запроса (курс+факультет) —
 * прежний loadTrigger-хак не нужен.
 *
 * @param onFilterChange — вызывается при смене факультета/курса/группы/периода
 *   (страница сбрасывает пагинацию списков).
 * @param enabled — false, пока роль сотрудника не подтверждена: ни один
 *   staff-запрос (группы/периоды) не выполняется для студента.
 * @param initial — восстановленные из адреса значения.
 */
export function useStaffFilters(
  onFilterChange?: () => void,
  enabled = true,
  initial: StaffFiltersInitial = NO_INITIAL,
): StaffFilters {
  const [facultyId, setFacultyId] = useState(initial.facultyId);
  const [course, setCourse] = useState(initial.course);
  const [groupId, setGroupId] = useState(initial.groupId);
  // 0 — «не выбран вручную»: тогда действует текущий семестр (деривация ниже).
  const [pickedSemesterId, setPickedSemesterId] = useState(initial.semesterId);

  const { data: ratingFilters } = useRatingFilters();
  const facultiesList = useMemo<Faculty[]>(
    () => [...(ratingFilters?.faculties ?? [])],
    [ratingFilters]
  );

  const { data: semesterOptions = [] } = useAcademicYears(enabled);

  // Текущий семестр — значение по умолчанию (деривация вместо setState-в-эффекте). Период из
  // адреса, которого нет в списке (удалён, опечатка), тоже даёт текущий.
  const currentSemester = semesterOptions.find((s) => s.is_current);
  const pickedKnown = semesterOptions.length === 0 || semesterOptions.some((s) => s.id === pickedSemesterId);
  const semesterId = pickedSemesterId !== 0 && pickedKnown ? pickedSemesterId : currentSemester?.id ?? 0;
  const semesterLabel = semesterOptions.find((s) => s.id === semesterId)?.label ?? '';

  const { data: groupsData } = useGroups(
    {
      course: course !== 'all' ? course : undefined,
      faculty_id: facultyId !== 'all' ? facultyId : undefined,
    },
    enabled
  );
  const groupsList = useMemo<Group[]>(() => groupsData ?? [], [groupsData]);

  // После загрузки групп выбранная остаётся, пока она есть в свежем списке (в т.ч.
  // восстановленная из адреса), иначе — «Все группы». Первую группу больше не подставляем:
  // «Все группы» курса — осмысленный выбор, и ссылка с ним не должна перезаписываться.
  // groupId намеренно НЕ в зависимостях — проверка через функциональное обновление
  // (идемпотентна, переживает двойной прогон эффектов в StrictMode).
  useEffect(() => {
    if (!groupsData) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- синхронизация выбора со свежезагруженным списком групп (событие «данные пришли»)
    setGroupId((prev) => (prev === 'all' || groupsData.some((g) => String(g.id) === prev) ? prev : 'all'));
  }, [groupsData]);

  const changeGroup = (value: string) => {
    setGroupId(value);
    onFilterChange?.();
  };

  const changeCourse = (value: string) => {
    setCourse(value);
    if (value === 'all') setGroupId('all');
    onFilterChange?.();
  };

  const changeFaculty = (value: string) => {
    // Прежняя цепочка onChange факультета: сброс курса и группы.
    setFacultyId(value);
    setCourse('all');
    setGroupId('all');
    onFilterChange?.();
  };

  const changeSemester = (id: number) => {
    setPickedSemesterId(id);
    onFilterChange?.();
  };

  const filterParams = useMemo(
    () => ({
      faculty_id: facultyId !== 'all' ? facultyId : undefined,
      course: course !== 'all' ? course : undefined,
    }),
    [facultyId, course]
  );

  return {
    facultyId,
    course,
    groupId,
    semesterId,
    semesterLabel,
    facultiesList,
    groupsList,
    semesterOptions,
    changeFaculty,
    changeCourse,
    changeGroup,
    changeSemester,
    filterParams,
  };
}
