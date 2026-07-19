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
  changeSemester: (id: number, label: string) => void;
  /** faculty_id/course для запросов (undefined при 'all'). */
  filterParams: { faculty_id?: string; course?: string };
}

/**
 * Состояние фильтров staff-профиля: факультет/курс/группа/период с каскадными
 * сбросами. Группы перезапрашиваются реактивно по ключу запроса (курс+факультет) —
 * прежний loadTrigger-хак не нужен.
 *
 * @param onFilterChange — вызывается при смене факультета/курса/группы
 *   (страница сбрасывает пагинацию списка студентов, как раньше).
 * @param enabled — false, пока роль сотрудника не подтверждена: ни один
 *   staff-запрос (группы/периоды) не выполняется для студента.
 */
export function useStaffFilters(onFilterChange?: () => void, enabled = true): StaffFilters {
  const [facultyId, setFacultyId] = useState('all');
  const [course, setCourse] = useState('all');
  const [groupId, setGroupId] = useState('all');
  // 0/'' — «не выбран вручную»: тогда действует текущий семестр (деривация ниже).
  const [pickedSemesterId, setPickedSemesterId] = useState(0);
  const [pickedSemesterLabel, setPickedSemesterLabel] = useState('');

  const { data: ratingFilters } = useRatingFilters();
  const facultiesList = useMemo<Faculty[]>(
    () => [...(ratingFilters?.faculties ?? [])],
    [ratingFilters]
  );

  const { data: semesterOptions = [] } = useAcademicYears(enabled);

  // Текущий семестр — значение по умолчанию (деривация вместо setState-в-эффекте).
  const currentSemester = semesterOptions.find((s) => s.is_current);
  const semesterId = pickedSemesterId !== 0 ? pickedSemesterId : currentSemester?.id ?? 0;
  const semesterLabel = pickedSemesterId !== 0 ? pickedSemesterLabel : currentSemester?.label ?? '';

  const { data: groupsData } = useGroups(
    {
      course: course !== 'all' ? course : undefined,
      faculty_id: facultyId !== 'all' ? facultyId : undefined,
    },
    enabled
  );
  const groupsList = useMemo<Group[]>(() => groupsData ?? [], [groupsData]);

  // Прежняя логика после загрузки групп: при 'all' в курсе/факультете группа
  // сбрасывается; иначе, если выбранной группы нет в свежем списке — берём первую.
  // groupId намеренно НЕ в зависимостях (ручной выбор «Все» не должен сбрасываться),
  // поэтому проверка — через функциональное обновление.
  useEffect(() => {
    if (!groupsData) return;
    if (course === 'all' || facultyId === 'all') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- синхронизация выбора со свежезагруженным списком групп (событие «данные пришли»)
      setGroupId('all');
    } else if (groupsData.length > 0) {
      setGroupId((prev) =>
        groupsData.some((g) => String(g.id) === prev) ? prev : String(groupsData[0].id)
      );
    }
  }, [groupsData, course, facultyId]);

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

  const changeSemester = (id: number, label: string) => {
    setPickedSemesterId(id);
    setPickedSemesterLabel(label);
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
