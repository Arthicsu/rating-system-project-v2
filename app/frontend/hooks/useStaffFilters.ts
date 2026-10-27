'use client';

import { useEffect, useMemo, useState } from 'react';

import type { CustomSelectOption } from '@/components/CustomSelect';
import { useAcademicYears, useGroups, useRatingFilters } from '@/hooks/queries';
import type { Faculty, Group, Semester } from '@/interfaces/StaffInterfaces';

/** Параметр периода для запросов кабинета и Excel: учебный год или один семестр. */
export type PeriodParams = { year_start?: string; academic_year?: string };

export interface StaffFilters {
  facultyId: string;
  course: string;
  groupId: string;
  /** Выбранный период: 'year:<год начала>' или 'sem:<id семестра>'; '' - семестров ещё нет. */
  period: string;
  periodLabel: string;
  periodParams: PeriodParams;
  /** Выбран период по умолчанию - текущий учебный год (в адрес страницы не пишется). */
  isDefaultPeriod: boolean;
  /** Пункты селекта «Период» (с галочкой - только текущий учебный год и выбранный период). */
  periodOptions: CustomSelectOption[];
  onlyCurrentYear: boolean;
  changeOnlyCurrentYear: (value: boolean) => void;
  facultiesList: Faculty[];
  groupsList: Group[];
  /** Смена факультета: сбрасывает курс и группу (прежняя цепочка handleFacultyChange+handleCourseChange('all')+handleGroupChange('all')). */
  changeFaculty: (value: string) => void;
  /** Смена курса: при 'all' сбрасывает группу. */
  changeCourse: (value: string) => void;
  changeGroup: (value: string) => void;
  changePeriod: (value: string) => void;
  /** faculty_id/course для запросов (undefined при 'all'). */
  filterParams: { faculty_id?: string; course?: string };
}

/** Начальные значения фильтров (из адреса страницы); пустой период — текущий учебный год. */
export interface StaffFiltersInitial {
  facultyId: string;
  course: string;
  groupId: string;
  period: string;
}

const NO_INITIAL: StaffFiltersInitial = { facultyId: 'all', course: 'all', groupId: 'all', period: '' };

/** Учебные годы, новые сверху; под каждым — его семестры («2025-2026 уч. год — осень»). */
function buildPeriodOptions(semesters: Semester[]): CustomSelectOption[] {
  const years = [...new Set(semesters.map((s) => s.year_start))].sort((a, b) => b - a);
  return years.flatMap((year) => [
    { value: `year:${year}`, label: `${year}-${year + 1} уч. год` },
    ...semesters
      .filter((s) => s.year_start === year)
      .sort((a, b) => a.start_date.localeCompare(b.start_date))
      .map((s) => ({ value: `sem:${s.id}`, label: s.label })),
  ]);
}

function periodParamsOf(period: string): PeriodParams {
  const [kind, id] = period.split(':');
  if (kind === 'year') return { year_start: id };
  if (kind === 'sem') return { academic_year: id };
  return {};
}

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
  // '' — «не выбран вручную»: тогда действует текущий учебный год (деривация ниже).
  const [pickedPeriod, setPickedPeriod] = useState(initial.period);
  // Через несколько лет список периодов разрастается: по умолчанию в нём только текущий год.
  const [onlyCurrentYear, setOnlyCurrentYear] = useState(true);

  const { data: ratingFilters } = useRatingFilters();
  const facultiesList = useMemo<Faculty[]>(
    () => [...(ratingFilters?.faculties ?? [])],
    [ratingFilters]
  );

  const { data: semesters } = useAcademicYears(enabled);
  const periodOptions = useMemo(() => buildPeriodOptions(semesters ?? []), [semesters]);

  // Текущий учебный год — значение по умолчанию (деривация вместо setState-в-эффекте). Период из
  // адреса, которого нет в списке (удалён, опечатка), тоже даёт текущий год.
  const current = semesters?.find((s) => s.is_current);
  const defaultPeriod = current ? `year:${current.year_start}` : '';
  const pickedKnown = periodOptions.length === 0 || periodOptions.some((o) => o.value === pickedPeriod);
  const period = pickedPeriod && pickedKnown ? pickedPeriod : defaultPeriod;
  const periodLabel = periodOptions.find((o) => o.value === period)?.label ?? '';
  const periodParams = useMemo(() => periodParamsOf(period), [period]);
  const visiblePeriodOptions = useMemo(() => {
    if (!onlyCurrentYear || !current) return periodOptions;
    const visible = buildPeriodOptions((semesters ?? []).filter((s) => s.year_start === current.year_start));
    // Выбранный прошлый период (из адреса или заметки о старых заявках) из списка не пропадает.
    const picked = periodOptions.find((o) => o.value === period);
    return picked && !visible.some((o) => o.value === picked.value) ? [...visible, picked] : visible;
  }, [onlyCurrentYear, current, semesters, periodOptions, period]);

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

  const changePeriod = (value: string) => {
    setPickedPeriod(value);
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
    period,
    periodLabel,
    periodParams,
    isDefaultPeriod: period === defaultPeriod,
    periodOptions: visiblePeriodOptions,
    onlyCurrentYear,
    changeOnlyCurrentYear: setOnlyCurrentYear,
    facultiesList,
    groupsList,
    changeFaculty,
    changeCourse,
    changeGroup,
    changePeriod,
    filterParams,
  };
}
