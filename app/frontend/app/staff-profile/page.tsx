'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import toast from 'react-hot-toast';
import type { AxiosError } from 'axios';

import { useMySession } from '@/context/AuthContext';
import ErrorState from '@/components/ErrorState';
import MobileFilterToggle from '@/components/MobileFilterToggle';

import FilterPanel from './_components/FilterPanel';
import TabsNav from './_components/TabsNav';
import StudentsTab from './_components/StudentsTab';
import PendingRequestsTab from './_components/PendingRequestsTab';
import ReviewedRequestsTab from './_components/ReviewedRequestsTab';
import StatisticsTab from './_components/StatisticsTab';
import ModalApprove from './_components/ModalApprove';
import ModalReject from './_components/ModalReject';

import { useRedirectIfLoggedOut } from '@/hooks/useRedirectIfLoggedOut';
import { useStaffFilters } from '@/hooks/useStaffFilters';
import { apiErrorMessage, isAuthError } from '@/lib/apiError';
import { useCategories, useDashboard, useRating } from '@/hooks/queries';
import { useReviewActions } from '@/hooks/useReviewActions';

import type {
  DashboardStats,
  DashboardStatsParams,
} from '@/interfaces/StaffInterfaces';
import type { RatingParams, Tab } from '@/interfaces/RatingInterfaces';
import type Student from '@/interfaces/StudentInterfaces';

const EMPTY_STATS: DashboardStats = {
  total_students: 0, avg_score: 0, max_score: 0, min_score: 0, categories: {},
  moderation: { submitted: 0, approved: 0, rejected: 0, pending: 0, returned: 0, oldest_pending_days: null },
};

const TAB_IDS = ['my-group', 'pending-requests', 'reviewed-requests', 'statistics'] as const;

// Состояние кабинета живёт в адресе: «Подробнее» → «Назад» возвращает в то же место,
// ссылку можно переслать. В адрес попадает только отличное от значения по умолчанию.
const URL_DEFAULTS = {
  tab: 'my-group', faculty: 'all', course: 'all', group: 'all', semester: '',
  cat: 'common', q: '', page: '1',
  rstate: 'all', rq: '', rpage: '1',
  vstate: 'all', vq: '', vpage: '1',
};
type UrlState = typeof URL_DEFAULTS;

/** Адрес — пользовательский ввод: неизвестные значения заменяются значениями по умолчанию. */
function readUrlState(params: { get(key: string): string | null }): UrlState {
  const get = (key: keyof UrlState, valid: (value: string) => boolean) => {
    const value = params.get(key);
    return value !== null && valid(value) ? value : URL_DEFAULTS[key];
  };
  const id = (v: string) => /^\d{1,9}$/.test(v);
  const page = (v: string) => /^[1-9]\d{0,5}$/.test(v);
  const text = (v: string) => v.length <= 100;
  const oneOf = (...values: readonly string[]) => (v: string) => values.includes(v);
  return {
    tab: get('tab', oneOf(...TAB_IDS)),
    faculty: get('faculty', id),
    course: get('course', oneOf('1', '2', '3', '4', '5')),
    group: get('group', id),
    semester: get('semester', id),
    // Неизвестную категорию сервер сортирует по общему баллу.
    cat: get('cat', (v) => /^\w{1,50}$/.test(v)),
    q: get('q', text),
    page: get('page', page),
    rstate: get('rstate', oneOf('new', 'returned')),
    rq: get('rq', text),
    rpage: get('rpage', page),
    vstate: get('vstate', oneOf('approved', 'rejected')),
    vq: get('vq', text),
    vpage: get('vpage', page),
  };
}

/**
 * Сервер отдаёт последнюю существующую страницу вместо пропавшей (одобрили последнюю
 * карточку на последней странице, старая ссылка) — переходим на неё, без экрана 404.
 */
function useServerPage(
  query: { data?: { page: number }; isPlaceholderData: boolean; isFetching: boolean },
  page: number,
  setPage: (page: number) => void,
) {
  // Пока показаны прежние данные или идёт перезапрос, номер не в счёт: в кэше страницы мог
  // остаться старый ответ (страница 3 отдавалась как 2), и он отменил бы клик по «3».
  const served = query.isPlaceholderData || query.isFetching ? undefined : query.data?.page;
  useEffect(() => {
    if (served && served !== page) setPage(served);
  }, [served, page, setPage]);
}

/**
 * Guard кабинета сотрудника: пока роль не подтверждена — не рендерим и не
 * выполняем НИ ОДНОГО хука кабинета (StaffDashboard не монтируется вовсе).
 *
 * Это убирает мигание staff-интерфейса у студента/анонима и не даёт странице
 * стрелять staff-запросами от чужого имени. Сама защита данных — на backend
 * (IsStaffProfile/CanReviewDocument, покрыто тестами): даже остановив рендер
 * через DevTools, не-сотрудник получит 403 на любой staff-ручке.
 */
export default function StaffProfilePage() {
  const { user, loading } = useMySession();
  const router = useRouter();
  useRedirectIfLoggedOut('/staff-profile');

  useEffect(() => {
    if (user && !user.is_employee) router.replace('/profile');
  }, [user, router]);

  if (loading || !user?.is_employee) {
    return null;
  }

  // useSearchParams в кабинете требует Suspense; кабинет и так рендерится только на клиенте.
  return (
    <Suspense fallback={null}>
      <StaffDashboard />
    </Suspense>
  );
}

/** Кабинет сотрудника; монтируется только после подтверждения роли (см. guard выше). */
function StaffDashboard() {
  const { user } = useMySession();
  const isRectorate = !!user?.roles?.includes('Rectorate');

  // Кабинет монтируется только на клиенте после проверки сессии (guard выше): адрес
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
      semesterId: Number(initial.semester) || 0,
    },
  );
  const { groupId, semesterId, semesterLabel, groupsList } = filters;

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

  // Прежний guard: без выбранной группы/семестра запросы не выполняются.
  const ready = !!groupId && !!semesterId;

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
      ...(categoriesData ?? []).map((cat) => ({
        id: cat.code,
        label: cat.label.endsWith('рейтинг') ? cat.label : `${cat.label} деятельность`,
      })),
    ],
    [categoriesData]
  );

  // Категория из адреса могла устареть (удалили в админке) — тогда общий рейтинг, а не NaN в баллах.
  const category =
    categoriesData && !categoriesData.some((c) => c.code === pickedCategory) ? 'common' : pickedCategory;
  const scoreKey = category === 'common' ? 'total_score' : `${category}_score`;

  // Таблица студентов — ручка рейтинга: семестр из фильтров кабинета,
  // категория/направление сортировки и поиск по ФИО/зачётке.
  const ratingParams = useMemo<RatingParams>(
    () => ({
      category,
      direction,
      page: currentPage,
      page_size: pageSize,
      search: groupSearchValue || undefined,
      academic_year: String(semesterId),
      group_id: groupId,
      ...filters.filterParams,
    }),
    [category, direction, currentPage, groupSearchValue, semesterId, groupId, filters.filterParams]
  );

  const studentsQuery = useRating(ratingParams, ready);
  const studentsData = (studentsQuery.data?.results ?? []) as Student[];
  const totalStudents = studentsQuery.data?.count ?? 0;
  // Как раньше: индикатор при первой загрузке и смене параметров, но не при фоновом поллинге.
  const studentsLoading = studentsQuery.isPending || studentsQuery.isPlaceholderData;

  const { openModal, canApprove, actionsFor, modalApproveProps, modalRejectProps } = useReviewActions();

  const pendingParams = useMemo<DashboardStatsParams>(
    () => ({
      group_id: groupId,
      academic_year: String(semesterId),
      page: requestsPage,
      page_size: requestsPageSize,
      ...filters.filterParams,
    }),
    [groupId, semesterId, requestsPage, filters.filterParams]
  );

  // Поллинг 15с заменяет прежний ручной setInterval: заявки появляются/исчезают
  // без перезагрузки, пауза на скрытой вкладке.
  const pendingQuery = useDashboard(pendingParams, { enabled: ready, pollMs: 15_000 });
  // Список под поиском или фильтром «Новые/Повторные» (таблетки только у кафедры) - отдельный
  // запрос: счётчик вкладки, статистика и топ-5 остаются по всем заявкам (pendingQuery без них).
  const pendingStateFilter =
    canApprove && pendingState !== 'all' ? (pendingState as DashboardStatsParams['state']) : undefined;
  const pendingFiltered = !!pendingStateFilter || !!pendingSearchValue;
  const filteredPendingQuery = useDashboard(
    { ...pendingParams, state: pendingStateFilter, search: pendingSearchValue || undefined },
    { enabled: ready && pendingFiltered, pollMs: 15_000 },
  );
  const pendingListQuery = pendingFiltered ? filteredPendingQuery : pendingQuery;
  const pendingDocsData = pendingListQuery.data?.results ?? [];
  const pendingListCount = pendingListQuery.data?.count ?? 0;
  const totalRequests = pendingQuery.data?.count ?? 0;
  const stats = pendingQuery.data?.stats ?? EMPTY_STATS;
  const top5Students = pendingQuery.data?.top5 ?? [];
  const pendingLoading = pendingListQuery.isPending || pendingListQuery.isPlaceholderData;

  const reviewedParams = useMemo<DashboardStatsParams>(
    () => ({
      group_id: groupId,
      academic_year: String(semesterId),
      page: reviewedPage,
      page_size: requestsPageSize,
      search: reviewedSearchValue || undefined,
      list_type: 'reviewed',
      state: reviewedState === 'all' ? undefined : (reviewedState as DashboardStatsParams['state']),
      ...filters.filterParams,
    }),
    [groupId, semesterId, reviewedPage, reviewedSearchValue, reviewedState, filters.filterParams]
  );

  const reviewedQuery = useDashboard(reviewedParams, {
    enabled: ready && activeTab === 'reviewed-requests',
  });
  const reviewedDocsData = reviewedQuery.data?.results ?? [];
  const totalReviewed = reviewedQuery.data?.count ?? 0;
  const reviewedLoading = reviewedQuery.isPending || reviewedQuery.isPlaceholderData;

  useServerPage(studentsQuery, currentPage, setCurrentPage);
  useServerPage(pendingListQuery, requestsPage, setRequestsPage);
  useServerPage(reviewedQuery, reviewedPage, setReviewedPage);

  // Состояние — в адрес. replace, а не push: «Назад» со страницы заявки возвращает сюда же,
  // а не листает назад каждый фильтр и каждую букву поиска.
  const currentSemesterId = filters.semesterOptions.find((s) => s.is_current)?.id;
  const urlState: UrlState = {
    tab: activeTab,
    faculty: filters.facultyId,
    course: filters.course,
    group: groupId,
    semester: semesterId && semesterId !== currentSemesterId ? String(semesterId) : '',
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
  const urlQuery = new URLSearchParams(
    Object.entries(urlState).filter(([key, value]) => value !== URL_DEFAULTS[key as keyof UrlState]),
  ).toString();
  // Сверка и с текущим адресом: если его сменили снаружи (ссылка в шапке), состояние вернётся в адрес.
  const currentQuery = searchParams.toString();
  useEffect(() => {
    if (urlQuery !== currentQuery) {
      // History API, а не router.replace: без запроса к серверу Next на каждую страницу и букву
      // поиска, и запись не теряется, если сразу нажать «Подробнее» (Next синхронизирует
      // useSearchParams с replaceState).
      window.history.replaceState(null, '', urlQuery ? `/staff-profile?${urlQuery}` : '/staff-profile');
    }
  }, [urlQuery, currentQuery]);

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
      <main className="min-h-screen bg-slate-50 pt-24 pb-10">
        <div className="mx-auto max-w-350 px-4 sm:px-5">
          <MobileFilterToggle
            expanded={mobileFiltersOpen}
            controls="mobile-filters"
            onClick={() => setMobileFiltersOpen((prev) => !prev)}
            visibleAt="max-[640px]:flex"
          />

          <FilterPanel filters={filters} isRectorate={isRectorate} mobileFiltersOpen={mobileFiltersOpen} />

          <TabsNav tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

          <div role="tabpanel" id="staff-tabpanel" aria-labelledby={`tab-${activeTab}`}>
          {activeTab === 'my-group' && (studentsErrorCode ? (
            <ErrorState code={studentsErrorCode} onReset={() => { void studentsQuery.refetch(); }} />
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
                academic_year: String(semesterId),
                page: currentPage,
              }}
              onCategoryChange={handleCategoryChange}
              onDirectionToggle={handleDirectionToggle}
              onSearch={handleGroupSearch}
              onPageChange={setCurrentPage}
            />
          ))}

          {activeTab === 'pending-requests' && (pendingListErrorCode ? (
            <ErrorState code={pendingListErrorCode} onReset={() => { void pendingListQuery.refetch(); }} />
          ) : (
            <PendingRequestsTab
              docs={pendingDocsData}
              loading={pendingLoading}
              totalRequests={pendingListCount}
              requestsPage={requestsPage}
              requestsPageSize={requestsPageSize}
              currentGroupName={currentGroupName}
              semesterLabel={semesterLabel}
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
            <ErrorState code={reviewedErrorCode} onReset={() => { void reviewedQuery.refetch(); }} />
          ) : (
            <ReviewedRequestsTab
              docs={reviewedDocsData}
              loading={reviewedLoading}
              totalReviewed={totalReviewed}
              reviewedPage={reviewedPage}
              requestsPageSize={requestsPageSize}
              currentGroupName={currentGroupName}
              semesterLabel={semesterLabel}
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
            <ErrorState code={pendingErrorCode} onReset={() => { void pendingQuery.refetch(); }} />
          ) : (
            <StatisticsTab
              stats={stats}
              top5={top5Students}
              activeRequests={totalRequests}
              isLeadership={!canApprove}
              scopeLabel={statsScopeLabel}
              semesterLabel={semesterLabel}
            />
          ))}
          </div>
        </div>
      </main>

      <ModalApprove {...modalApproveProps} />

      <ModalReject {...modalRejectProps} />
    </>
  );
}
