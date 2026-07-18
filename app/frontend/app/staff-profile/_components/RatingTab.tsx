'use client';
import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import type { AxiosError } from 'axios';
import ErrorState from '@/components/ErrorState';
import MobileFilterToggle from '@/components/MobileFilterToggle';
import RatingTabs from './RatingTabs';
import RatingMobileFilters from './RatingMobileFilters';
import RatingTable from './RatingTable';
import { useCategories, useRatingFilters } from '@/hooks/queries/useLookups';
import { useRating } from '@/hooks/queries/useRating';
import type { FilterOptions, RatingFilterConfig, RatingParams, Tab } from '@/interfaces/RatingInterfaces';
import type Student from '@/interfaces/StudentInterfaces';

const EMPTY_FILTER_OPTIONS: FilterOptions = { faculties: [], courses: [], groups: [] };

/**
 * Вкладка «Рейтинг» кабинета сотрудника: рейтинг всех студентов за текущий
 * семестр. Фильтры (факультет/курс/группа) и категория здесь свои и от
 * фильтров кабинета (группа/семестр из FilterPanel) не зависят.
 */
export default function RatingTab() {
  const [selectedFaculty, setSelectedFaculty] = useState('all');
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [activeTab, setActiveTab] = useState('common');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const { data: categoriesData, error: categoriesError } = useCategories();
  useEffect(() => {
    if (categoriesError) toast.error('Ошибка: ' + categoriesError);
  }, [categoriesError]);

  const tabs = useMemo<Tab[]>(
    () => [
      { id: 'common', label: 'Общий рейтинг' },
      ...(categoriesData ?? []).map((cat) => ({
        id: cat.code,
        label: cat.label.endsWith('рейтинг') ? cat.label : `${cat.label} деятельность`,
      })),
    ],
    [categoriesData]
  );

  const { data: filterOptions = EMPTY_FILTER_OPTIONS } = useRatingFilters();

  const ratingParams = useMemo<RatingParams>(() => {
    const params: RatingParams = {
      category: activeTab,
      page: currentPage,
      page_size: pageSize,
    };
    if (selectedFaculty !== 'all') params.faculty_id = selectedFaculty;
    if (selectedCourse !== 'all') params.course = selectedCourse;
    if (selectedGroup !== 'all') params.group_id = selectedGroup;
    return params;
  }, [activeTab, currentPage, selectedFaculty, selectedCourse, selectedGroup]);

  const { data: ratingData, isFetching: loading, error: ratingError, refetch: refetchRating } = useRating(ratingParams);
  useEffect(() => {
    if (ratingError) console.error('Ошибка: ', ratingError);
  }, [ratingError]);

  // Как раньше: при ошибке список очищается, при загрузке видны прежние строки.
  // Student — UI-тип строки с индекс-сигнатурой (динамический доступ к баллам по коду категории).
  const students: Student[] = ratingError ? [] : ratingData?.results ?? [];
  const totalCount = ratingError ? 0 : ratingData?.count ?? 0;

  const availableGroups = useMemo(() => {
    return filterOptions.groups.filter(g => {
      const matchFaculty = selectedFaculty === 'all' || String(g.faculty_id) === String(selectedFaculty);
      const matchCourse = selectedCourse === 'all' || String(g.course) === String(selectedCourse);
      return matchFaculty && matchCourse;
    });
  }, [filterOptions.groups, selectedFaculty, selectedCourse]);

  const scoreKey = activeTab === 'common' ? 'total_score' : `${activeTab}_score`;

  const handleTabChange = (id: string) => {
    setActiveTab(id);
    setCurrentPage(1);
  };

  const handleFilterChange = (setter: (value: string) => void, value: string) => {
    setter(value);
    setCurrentPage(1);
  };

  // Каскад фильтров в одном месте: факультет сбрасывает курс и группу,
  // курс сбрасывает группу. Конфиг рендерят и мобильная панель,
  // и селекты в шапке таблицы.
  const ratingFilters: RatingFilterConfig[] = [
    {
      id: 'faculty',
      label: 'Факультет',
      value: selectedFaculty,
      options: [
        { value: 'all', label: 'Все' },
        ...filterOptions.faculties.map((f) => ({ value: String(f.id), label: f.short_name })),
      ],
      onChange: (value) => {
        handleFilterChange(setSelectedFaculty, value);
        handleFilterChange(setSelectedCourse, 'all');
        handleFilterChange(setSelectedGroup, 'all');
      },
    },
    {
      id: 'course',
      label: 'Курс',
      value: selectedCourse,
      options: [
        { value: 'all', label: 'Все' },
        ...[1, 2, 3, 4, 5].map((c) => ({ value: String(c), label: `${c} курс` })),
      ],
      onChange: (value) => {
        handleFilterChange(setSelectedCourse, value);
        handleFilterChange(setSelectedGroup, 'all');
      },
    },
    {
      id: 'group',
      label: 'Группа',
      value: selectedGroup,
      disabled: availableGroups.length === 0,
      options: [
        { value: 'all', label: 'Все' },
        ...availableGroups.map((g) => ({ value: String(g.id), label: g.name })),
      ],
      onChange: (value) => handleFilterChange(setSelectedGroup, value),
    },
  ];

  return (
    <div className="mt-5">
      <RatingTabs tabs={tabs} activeTab={activeTab} onChange={handleTabChange} />

      <MobileFilterToggle visibleAt="max-[411px]:flex" onClick={() => setMobileFiltersOpen((prev) => !prev)} />

      <RatingMobileFilters open={mobileFiltersOpen} filters={ratingFilters} />

      {ratingError && !ratingData ? (
        // Данные недоступны (5xx/сеть): остаёмся на вкладке, показываем ErrorState с ретраем.
        <ErrorState
          code={(ratingError as AxiosError).response?.status ?? 500}
          onReset={() => { void refetchRating(); }}
        />
      ) : (
        // key по вкладке перезапускает fade-анимацию таблицы при переключении.
        <RatingTable
          key={activeTab}
          filters={ratingFilters}
          students={students}
          loading={loading}
          scoreKey={scoreKey}
          currentPage={currentPage}
          pageSize={pageSize}
          totalCount={totalCount}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
}
