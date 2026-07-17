'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { AxiosError } from 'axios';

import { useMySession } from '@/context/AuthContext';
import ErrorState from '@/components/ErrorState';
import MobileFilterToggle from '@/components/MobileFilterToggle';

import FilterPanel from './_components/FilterPanel';
import TabsNav from './_components/TabsNav';
import MyGroupTab from './_components/MyGroupTab';
import PendingRequestsTab from './_components/PendingRequestsTab';
import ReviewedRequestsTab from './_components/ReviewedRequestsTab';
import StatisticsTab from './_components/StatisticsTab';
import ModalApprove from './_components/ModalApprove';
import ModalReject from './_components/ModalReject';

import { useStaffFilters } from '@/hooks/useStaffFilters';
import { useStudents } from '@/hooks/queries/useStudents';
import { useDashboard } from '@/hooks/queries/useDashboard';
import { useTabParam } from '@/hooks/useTabParam';
import { useReviewActions } from '@/hooks/useReviewActions';

import type {
  DashboardStats,
  DashboardStatsParams,
  FilterStudentsParams,
} from '@/interfaces/StaffInterfaces';
import type Student from '@/interfaces/StudentInterfaces';

const EMPTY_STATS: DashboardStats = { total_students: 0, avg_score: 0, max_score: 0, min_score: 0, categories: {} };

const TAB_IDS = ['my-group', 'pending-requests', 'reviewed-requests', 'statistics'] as const;

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

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
    } else if (!user.is_staff) {
      router.replace('/profile');
    }
  }, [user, loading, router]);

  if (loading || !user?.is_staff) {
    return null;
  }

  return <StaffDashboard />;
}

/** Кабинет сотрудника; монтируется только после подтверждения роли (см. guard выше). */
function StaffDashboard() {
  const { user } = useMySession();
  const isRectorate = !!user?.roles?.includes('Rectorate');

  const { activeTab, changeTab } = useTabParam(TAB_IDS, 'my-group', '/staff-profile');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [requestsPage, setRequestsPage] = useState(1);
  const [reviewedPage, setReviewedPage] = useState(1);

  const [groupSearchValue, setGroupSearchValue] = useState('');
  const [pendingSearchValue, setPendingSearchValue] = useState('');
  const [reviewedSearchValue, setReviewedSearchValue] = useState('');

  const pageSize = 20;
  const requestsPageSize = 6;

  // Смена фильтров сбрасывает страницу списка студентов (как прежние handle*Change).
  // Роль сотрудника гарантирована guard-обёрткой StaffProfilePage.
  const filters = useStaffFilters(() => setCurrentPage(1));
  const { groupId, semesterId, semesterLabel, groupsList } = filters;

  // Поиск сбрасывает пагинацию соответствующего списка (обработчики вместо эффектов).
  const handleGroupSearch = (value: string) => {
    setGroupSearchValue(value);
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

  const studentsParams = useMemo<FilterStudentsParams>(
    () => ({
      group_id: groupId,
      page: currentPage,
      page_size: pageSize,
      search: groupSearchValue || undefined,
      academic_year: String(semesterId),
      ...filters.filterParams,
    }),
    [groupId, currentPage, groupSearchValue, semesterId, filters.filterParams]
  );

  const studentsQuery = useStudents(studentsParams, ready);
  const studentsData = (studentsQuery.data?.results ?? []) as Student[];
  const totalStudents = studentsQuery.data?.count ?? 0;
  // Как раньше: индикатор при первой загрузке и смене параметров, но не при фоновом поллинге.
  const studentsLoading = studentsQuery.isPending || studentsQuery.isPlaceholderData;

  const pendingParams = useMemo<DashboardStatsParams>(
    () => ({
      group_id: groupId,
      academic_year: String(semesterId),
      page: requestsPage,
      page_size: requestsPageSize,
      search: pendingSearchValue || undefined,
      ...filters.filterParams,
    }),
    [groupId, semesterId, requestsPage, pendingSearchValue, filters.filterParams]
  );

  // Поллинг 15с заменяет прежний ручной setInterval: заявки появляются/исчезают
  // без перезагрузки, пауза на скрытой вкладке.
  const pendingQuery = useDashboard(pendingParams, { enabled: ready, pollMs: 15_000 });
  const pendingDocsData = pendingQuery.data?.results ?? [];
  const totalRequests = pendingQuery.data?.count ?? 0;
  const stats = pendingQuery.data?.stats ?? EMPTY_STATS;
  const top5Students = pendingQuery.data?.top5 ?? [];
  const pendingLoading = pendingQuery.isPending || pendingQuery.isPlaceholderData;

  const reviewedParams = useMemo<DashboardStatsParams>(
    () => ({
      group_id: groupId,
      academic_year: String(semesterId),
      page: reviewedPage,
      page_size: requestsPageSize,
      search: reviewedSearchValue || undefined,
      list_type: 'reviewed',
      ...filters.filterParams,
    }),
    [groupId, semesterId, reviewedPage, reviewedSearchValue, filters.filterParams]
  );

  const reviewedQuery = useDashboard(reviewedParams, {
    enabled: ready && activeTab === 'reviewed-requests',
  });
  const reviewedDocsData = reviewedQuery.data?.results ?? [];
  const totalReviewed = reviewedQuery.data?.count ?? 0;
  const reviewedLoading = reviewedQuery.isPending || reviewedQuery.isPlaceholderData;

  const { openModal, canApprove, modalApproveProps, modalRejectProps } = useReviewActions();

  const currentGroupName = groupId === 'all'
    ? 'Все группы'
    : (groupsList.find(g => String(g.id) === groupId)?.name || 'Все группы');

  const tabs = [
    { id: 'my-group', label: 'Группа' },
    { id: 'pending-requests', label: 'Заявки на подтверждение', badge: totalRequests },
    { id: 'reviewed-requests', label: 'Рассмотренные заявки' },
    { id: 'statistics', label: 'Статистика' },
  ];

  // ErrorState вместо вкладки — только когда данных нет совсем (5xx/сеть);
  // при сбое фонового рефетча показываем прежние данные.
  const tabError = (queryError: unknown, hasData: boolean) =>
    queryError && !hasData ? ((queryError as AxiosError).response?.status ?? 500) : null;

  const studentsErrorCode = tabError(studentsQuery.error, !!studentsQuery.data);
  const pendingErrorCode = tabError(pendingQuery.error, !!pendingQuery.data);
  const reviewedErrorCode = tabError(reviewedQuery.error, !!reviewedQuery.data);

  return (
    <>
      <main className="min-h-screen bg-slate-50 pt-24 pb-10">
        <div className="mx-auto max-w-350 px-4 sm:px-5">
          <MobileFilterToggle onClick={() => setMobileFiltersOpen((prev) => !prev)} visibleAt="max-[640px]:flex" />

          <FilterPanel filters={filters} isRectorate={isRectorate} mobileFiltersOpen={mobileFiltersOpen} />

          <TabsNav tabs={tabs} activeTab={activeTab} onChange={changeTab} />

          {activeTab === 'my-group' && (studentsErrorCode ? (
            <ErrorState code={studentsErrorCode} onReset={() => { void studentsQuery.refetch(); }} />
          ) : (
            <MyGroupTab
              students={studentsData}
              loading={studentsLoading}
              totalStudents={totalStudents}
              currentPage={currentPage}
              pageSize={pageSize}
              isRectorate={isRectorate}
              selectedGroupId={groupId}
              selectedCourse={filters.course}
              currentGroupName={currentGroupName}
              onSearch={handleGroupSearch}
              onPageChange={setCurrentPage}
            />
          ))}

          {activeTab === 'pending-requests' && (pendingErrorCode ? (
            <ErrorState code={pendingErrorCode} onReset={() => { void pendingQuery.refetch(); }} />
          ) : (
            <PendingRequestsTab
              docs={pendingDocsData}
              loading={pendingLoading}
              totalRequests={totalRequests}
              requestsPage={requestsPage}
              requestsPageSize={requestsPageSize}
              currentGroupName={currentGroupName}
              semesterLabel={semesterLabel}
              canApprove={canApprove}
              onSearch={handlePendingSearch}
              onPageChange={setRequestsPage}
              onApprove={(doc) => openModal('approve', doc)}
              onReject={(doc) => openModal('reject', doc)}
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
              onSearch={handleReviewedSearch}
              onPageChange={setReviewedPage}
              onApprove={(doc) => openModal('approve', doc)}
              onReject={(doc) => openModal('reject', doc)}
            />
          ))}

          {activeTab === 'statistics' && (pendingErrorCode ? (
            <ErrorState code={pendingErrorCode} onReset={() => { void pendingQuery.refetch(); }} />
          ) : (
            <StatisticsTab
              stats={stats}
              top5={top5Students}
              activeRequests={pendingDocsData.length}
              currentGroupName={currentGroupName}
              semesterLabel={semesterLabel}
            />
          ))}
        </div>
      </main>

      <ModalApprove {...modalApproveProps} />

      <ModalReject {...modalRejectProps} />
    </>
  );
}
