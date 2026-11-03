'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import type { AxiosError } from 'axios';

import { useMySession } from '@/context/AuthContext';
import ErrorState from '@/components/ErrorState';
import MobileFilterToggle from '@/components/MobileFilterToggle';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import { cabinetTitle } from '@/components/layout/userLabels';

import FilterPanel from './FilterPanel';
import PastPendingNotice from './PastPendingNotice';
import TabsNav from '@/components/TabsNav';
import StudentsTab from './StudentsTab';
import PendingRequestsTab from './PendingRequestsTab';
import ReviewedRequestsTab from './ReviewedRequestsTab';
import StatisticsTab from './StatisticsTab';
import ModalApprove from './ModalApprove';
import ModalReject from './ModalReject';
import { TAB_IDS, URL_DEFAULTS, readUrlState, urlQuery, type UrlState } from './urlState';
import { useServerPage } from './useServerPage';
import { useStudentsList } from './useStudentsList';
import { usePendingLists } from './usePendingLists';
import { useReviewedList } from './useReviewedList';

import { useStaffFilters } from '@/hooks/useStaffFilters';
import { usePendingCount } from '@/hooks/queries';
import { useReviewActions } from '@/hooks/useReviewActions';

import type { DashboardStatsParams } from '@/interfaces/StaffInterfaces';

/** Кабинет сотрудника; монтируется только после подтверждения роли (см. guard в page.tsx). */
export default function StaffDashboard() {
  const { user } = useMySession();
  const isRectorate = !!user?.roles?.includes('Rectorate');

  // Кабинет монтируется только на клиенте после проверки сессии (guard в page.tsx): адрес
  // читаем сразу — без расхождения гидрации и без лишнего запроса со значениями по умолчанию.
  const searchParams = useSearchParams();
  const [initial] = useState(() => readUrlState(searchParams));

  const [activeTab, setActiveTab] = useState(initial.tab);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Ссылки в шапке («Заявки», имя) и «Назад»/«Вперёд» браузера меняют адрес, не перемонтируя
  // кабинет: вкладку берём из адреса (подстройка состояния при рендере, без эффекта). Фильтры,
  // поиск и страницы при этом остаются текущими — эффект ниже запишет их обратно в адрес.
  const urlTab = searchParams.get('tab');
  const [seenUrlTab, setSeenUrlTab] = useState(urlTab);
  if (urlTab !== seenUrlTab) {
    setSeenUrlTab(urlTab);
    setActiveTab(urlTab && (TAB_IDS as readonly string[]).includes(urlTab) ? urlTab : URL_DEFAULTS.tab);
  }

  const [currentPage, setCurrentPage] = useState(Number(initial.page));
  const [requestsPage, setRequestsPage] = useState(Number(initial.rpage));
  const [reviewedPage, setReviewedPage] = useState(Number(initial.vpage));

  const [groupSearchValue, setGroupSearchValue] = useState(initial.q);
  const [pendingSearchValue, setPendingSearchValue] = useState(initial.rq);
  const [reviewedSearchValue, setReviewedSearchValue] = useState(initial.vq);
  // Фильтр состояния заявок ('all' - без фильтра); смена сбрасывает пагинацию на 1.
  const [pendingState, setPendingState] = useState(initial.rstate);
  const [reviewedState, setReviewedState] = useState(initial.vstate);

  // Подвкладка категории и направление сортировки таблицы студентов.
  const [pickedCategory, setCategory] = useState(initial.cat);
  // Направление в адрес не пишем: каждый заход начинается «по убыванию баллов».
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');

  const pageSize = 20;
  // 12 карточек: очередь видна целиком чаще, меньше листать (сетка 3 × 4 на десктопе).
  const requestsPageSize = 12;

  // Смена группы, курса, факультета или периода меняет все списки — каждый с первой страницы.
  // Роль сотрудника гарантирована guard-обёрткой StaffProfilePage.
  const filters = useStaffFilters(
    () => {
      setCurrentPage(1);
      setRequestsPage(1);
      setReviewedPage(1);
    },
    true,
    {
      // Селект факультета есть только у ректората: у остальных значение из чужой ссылки
      // было бы скрытым фильтром без способа его снять.
      facultyId: isRectorate ? initial.faculty : 'all',
      course: initial.course,
      groupId: initial.group,
      period: initial.period,
    },
  );
  const { groupId, period, periodLabel, periodParams, groupsList } = filters;

  // Поиск сбрасывает пагинацию соответствующего списка (обработчики вместо эффектов).
  const handleGroupSearch = (value: string) => {
    setGroupSearchValue(value);
    setCurrentPage(1);
  };

  const handleCategoryChange = (id: string) => {
    setCategory(id);
    setCurrentPage(1);
  };

  const handleDirectionToggle = () => {
    setDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    setCurrentPage(1);
  };

  const handlePendingSearch = (value: string) => {
    setPendingSearchValue(value);
    setRequestsPage(1);
  };

  const handleReviewedSearch = (value: string) => {
    setReviewedSearchValue(value);
    setReviewedPage(1);
  };

  // Прежний guard: без выбранной группы/периода запросы не выполняются.
  const ready = !!groupId && !!period;

  const {
    categoryTabs,
    category,
    scoreKey,
    query: studentsQuery,
    students: studentsData,
    total: totalStudents,
    loading: studentsLoading,
  } = useStudentsList({
    pickedCategory,
    direction,
    page: currentPage,
    pageSize,
    search: groupSearchValue,
    groupId,
    periodParams,
    filterParams: filters.filterParams,
    ready,
  });

  const { openModal, canApprove, actionsFor, modalApproveProps, modalRejectProps } = useReviewActions();
  // Тот же запрос, что у счётчика в шапке (общий ключ): заявки прошлых лет для заметки.
  const pendingCountQuery = usePendingCount(true);

  const pendingStateFilter =
    canApprove && pendingState !== 'all' ? (pendingState as DashboardStatsParams['state']) : undefined;
  const {
    pendingQuery,
    listQuery: pendingListQuery,
    docs: pendingDocsData,
    listCount: pendingListCount,
    totalRequests,
    stats,
    top5: top5Students,
    loading: pendingLoading,
  } = usePendingLists({
    groupId,
    periodParams,
    filterParams: filters.filterParams,
    page: requestsPage,
    pageSize: requestsPageSize,
    stateFilter: pendingStateFilter,
    search: pendingSearchValue,
    ready,
  });

  const {
    query: reviewedQuery,
    docs: reviewedDocsData,
    total: totalReviewed,
    loading: reviewedLoading,
  } = useReviewedList({
    groupId,
    periodParams,
    filterParams: filters.filterParams,
    page: reviewedPage,
    pageSize: requestsPageSize,
    search: reviewedSearchValue,
    state: reviewedState,
    enabled: ready && activeTab === 'reviewed-requests',
  });

  useServerPage(studentsQuery, currentPage, setCurrentPage);
  useServerPage(pendingListQuery, requestsPage, setRequestsPage);
  useServerPage(reviewedQuery, reviewedPage, setReviewedPage);

  // Состояние — в адрес. replace, а не push: «Назад» со страницы заявки возвращает сюда же,
  // а не листает назад каждый фильтр и каждую букву поиска.
  const urlState: UrlState = {
    tab: activeTab,
    faculty: filters.facultyId,
    course: filters.course,
    group: groupId,
    period: filters.isDefaultPeriod ? '' : period,
    cat: category,
    q: groupSearchValue,
    page: String(currentPage),
    rstate: pendingState,
    rq: pendingSearchValue,
    rpage: String(requestsPage),
    vstate: reviewedState,
    vq: reviewedSearchValue,
    vpage: String(reviewedPage),
  };
  const query = urlQuery(urlState);
  // Сверка и с текущим адресом: если его сменили снаружи (ссылка в шапке), состояние вернётся в адрес.
  const currentQuery = searchParams.toString();
  useEffect(() => {
    if (query !== currentQuery) {
      // History API, а не router.replace: без запроса к серверу Next на каждую страницу и букву
      // поиска, и запись не теряется, если сразу нажать «Подробнее» (Next синхронизирует
      // useSearchParams с replaceState).
      window.history.replaceState(null, '', query ? `/staff-profile?${query}` : '/staff-profile');
    }
  }, [query, currentQuery]);

  // Заголовок статистики — по выбранным фильтрам: факультет, курс, группа (или все студенты).
  const statsScopeLabel = [
    filters.facultyId !== 'all' ? filters.facultiesList.find((f) => String(f.id) === filters.facultyId)?.short_name : null,
    filters.course !== 'all' ? `${filters.course} курс` : null,
    groupId !== 'all' ? groupsList.find((g) => String(g.id) === groupId)?.name : null,
  ].filter(Boolean).join(', ') || 'все студенты';

  const currentGroupName = groupId === 'all'
    ? 'Все группы'
    : (groupsList.find(g => String(g.id) === groupId)?.name || 'Все группы');

  const tabs = [
    { id: 'my-group', label: 'Студенты' },
    // У руководства — подтверждённые кафедрой заявки для контроля (вариант А), счётчик нейтральный.
    canApprove
      ? { id: 'pending-requests', label: 'Заявки на рассмотрение', badge: totalRequests }
      : { id: 'pending-requests', label: 'На контроле', badge: totalRequests, badgeTone: 'neutral' as const },
    { id: 'reviewed-requests', label: 'Рассмотренные заявки' },
    { id: 'statistics', label: 'Статистика' },
  ];

  // ErrorState вместо вкладки — только когда данных нет совсем (5xx/сеть);
  // при сбое фонового рефетча показываем прежние данные.
  const tabError = (queryError: unknown, hasData: boolean) =>
    queryError && !hasData ? ((queryError as AxiosError).response?.status ?? 500) : null;

  const studentsErrorCode = tabError(studentsQuery.error, !!studentsQuery.data);
  const pendingErrorCode = tabError(pendingQuery.error, !!pendingQuery.data);
  const pendingListErrorCode = tabError(pendingListQuery.error, !!pendingListQuery.data);
  const reviewedErrorCode = tabError(reviewedQuery.error, !!reviewedQuery.data);

  return (
    <>
      <PageContainer>
        <PageHeader
          title={cabinetTitle(user?.roles ?? [])}
          actions={
            <MobileFilterToggle
              expanded={mobileFiltersOpen}
              controls="mobile-filters"
              onClick={() => setMobileFiltersOpen((prev) => !prev)}
              visibleAt="max-[640px]:flex"
            />
          }
        />

        <FilterPanel filters={filters} isRectorate={isRectorate} mobileFiltersOpen={mobileFiltersOpen} />

        <PastPendingNotice
          items={(pendingCountQuery.data?.past_pending ?? []).filter((item) => period !== `year:${item.year_start}`)}
          onPick={(yearStart) => {
            filters.changePeriod(`year:${yearStart}`);
            setActiveTab('pending-requests');
          }}
        />

        <TabsNav label="Разделы кабинета" panelId="staff-tabpanel" tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

        <div key={activeTab} role="tabpanel" id="staff-tabpanel" aria-labelledby={`tab-${activeTab}`} className="animate-rise">
        {activeTab === 'my-group' && (studentsErrorCode ? (
          <ErrorState titleAs="h2" code={studentsErrorCode} onReset={() => { void studentsQuery.refetch(); }} />
        ) : (
          <StudentsTab
            students={studentsData}
            loading={studentsLoading}
            totalStudents={totalStudents}
            currentPage={currentPage}
            pageSize={pageSize}
            isRectorate={isRectorate}
            selectedGroupId={groupId}
            currentGroupName={currentGroupName}
            categoryTabs={categoryTabs}
            activeCategory={category}
            scoreKey={scoreKey}
            direction={direction}
            searchValue={groupSearchValue}
            exportParams={{
              faculty_id: filters.facultyId,
              course: filters.course,
              group_id: groupId,
              category,
              direction,
              ...periodParams,
              page: currentPage,
            }}
            onCategoryChange={handleCategoryChange}
            onDirectionToggle={handleDirectionToggle}
            onSearch={handleGroupSearch}
            onPageChange={setCurrentPage}
          />
        ))}

        {activeTab === 'pending-requests' && (pendingListErrorCode ? (
          <ErrorState titleAs="h2" code={pendingListErrorCode} onReset={() => { void pendingListQuery.refetch(); }} />
        ) : (
          <PendingRequestsTab
            docs={pendingDocsData}
            loading={pendingLoading}
            totalRequests={pendingListCount}
            requestsPage={requestsPage}
            requestsPageSize={requestsPageSize}
            currentGroupName={currentGroupName}
            periodLabel={periodLabel}
            title={canApprove ? 'Заявки' : 'На контроле'}
            hint={canApprove ? undefined : 'Одобренные кафедрой заявки: можно отклонить или вернуть кафедре на повторное рассмотрение.'}
            showStateFilter={canApprove}
            stateValue={pendingState}
            onStateChange={(value) => { setPendingState(value); setRequestsPage(1); }}
            searchValue={pendingSearchValue}
            onSearch={handlePendingSearch}
            onResetFilters={() => { setPendingSearchValue(''); setPendingState('all'); setRequestsPage(1); }}
            onPageChange={setRequestsPage}
            actionsFor={actionsFor}
            onAction={openModal}
          />
        ))}

        {activeTab === 'reviewed-requests' && (reviewedErrorCode ? (
          <ErrorState titleAs="h2" code={reviewedErrorCode} onReset={() => { void reviewedQuery.refetch(); }} />
        ) : (
          <ReviewedRequestsTab
            docs={reviewedDocsData}
            loading={reviewedLoading}
            totalReviewed={totalReviewed}
            reviewedPage={reviewedPage}
            requestsPageSize={requestsPageSize}
            currentGroupName={currentGroupName}
            periodLabel={periodLabel}
            stateValue={reviewedState}
            onStateChange={(value) => { setReviewedState(value); setReviewedPage(1); }}
            searchValue={reviewedSearchValue}
            onSearch={handleReviewedSearch}
            onResetFilters={() => { setReviewedSearchValue(''); setReviewedState('all'); setReviewedPage(1); }}
            onPageChange={setReviewedPage}
            actionsFor={actionsFor}
            onAction={openModal}
          />
        ))}

        {activeTab === 'statistics' && (pendingErrorCode ? (
          <ErrorState titleAs="h2" code={pendingErrorCode} onReset={() => { void pendingQuery.refetch(); }} />
        ) : (
          <StatisticsTab
            stats={stats}
            top5={top5Students}
            activeRequests={totalRequests}
            isLeadership={!canApprove}
            scopeLabel={statsScopeLabel}
            periodLabel={periodLabel}
          />
        ))}
        </div>
      </PageContainer>

      <ModalApprove {...modalApproveProps} />

      <ModalReject {...modalRejectProps} />
    </>
  );
}
