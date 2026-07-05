'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

import { useMySession } from '@/context/AuthContext';
import ModalApprove from '@/components/modals/modalApprove';
import ModalReject from '@/components/modals/modalReject';
import FilterPanel from '@/components/staff/FilterPanel';
import MyGroupTab from '@/components/staff/MyGroupTab';
import PendingRequestsTab from '@/components/staff/PendingRequestsTab';
import ReviewedRequestsTab from '@/components/staff/ReviewedRequestsTab';
import StatisticsTab from '@/components/staff/StatisticsTab';

import { useStaffFilters } from '@/hooks/useStaffFilters';
import { useStudents } from '@/hooks/queries/useStudents';
import { useDashboard } from '@/hooks/queries/useDashboard';
import { useCategories, useRejectionReasons } from '@/hooks/queries/useLookups';
import { useReviewDocument } from '@/hooks/queries/useReviewDocument';

import type {
  DashboardStats,
  DashboardStatsParams,
  Document,
  FilterStudentsParams,
  ModalState,
} from '@/interfaces/StaffInterfaces';
import type Student from '@/interfaces/StudentInterfaces';

const EMPTY_STATS: DashboardStats = { total_students: 0, avg_score: 0, max_score: 0, min_score: 0, categories: {} };

/**
 * Staff-профиль: оркестратор вкладок (Группа / Заявки / Рассмотренные / Статистика).
 * Данные — TanStack Query (hooks/queries), фильтры — useStaffFilters,
 * разметка вкладок — components/staff/* (JSX перенесён дословно).
 */
export default function StaffProfilePage() {
  const { user, refreshUser } = useMySession();
  const router = useRouter();
  const isRectorate = !!user?.roles?.includes('Rectorate');

  const [activeTab, setActiveTab] = useState('my-group');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const [modalState, setModalState] = useState<ModalState>({
    type: null,
    targetId: null,
    targetScore: 0,
    targetStudentId: null,
  });
  const [rejectReasons, setRejectReasons] = useState<number[]>([]);
  const [customReason, setCustomReason] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [requestsPage, setRequestsPage] = useState(1);
  const [reviewedPage, setReviewedPage] = useState(1);

  const [groupSearchValue, setGroupSearchValue] = useState('');
  const [pendingSearchValue, setPendingSearchValue] = useState('');
  const [reviewedSearchValue, setReviewedSearchValue] = useState('');

  const pageSize = 20;
  const requestsPageSize = 6;

  useEffect(() => {
    if (user && !user.is_staff) {
      router.replace('/profile');
    }
  }, [user, router]);

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    if (tab && ['my-group', 'pending-requests', 'reviewed-requests', 'statistics'].includes(tab)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- синхронизация состояния с ?tab= после гидрации (лениво инициализировать нельзя: hydration mismatch)
      setActiveTab(tab);
    }
  }, []);

  // Смена фильтров сбрасывает страницу списка студентов (как прежние handle*Change).
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

  const { data: rejectionReasonsList = [] } = useRejectionReasons();
  const { data: categoriesData = [] } = useCategories();

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

  const dynamicStats = useMemo(() => {
    // Распределение по категориям и min/max приходят с бэка уже посчитанными за выбранный
    // семестр (по всем отфильтрованным студентам, а не по одной странице таблицы).
    const catStats: Record<string, number> = {};
    categoriesData.forEach(cat => {
      catStats[cat.label] = stats.categories?.[cat.code] ?? 0;
    });

    return {
      total_students: stats.total_students,
      avg_score: stats.avg_score,
      max_score: stats.max_score,
      min_score: stats.min_score,
      active_requests: (pendingDocsData || []).length,
      top5: top5Students,
      categories: catStats,
    };
  }, [pendingDocsData, categoriesData, stats, top5Students]);

  const openModal = (type: string, doc: Document) => {
    setModalState({
      type,
      targetId: doc.id,
      targetScore: doc.score ?? 0,
      targetStudentId: doc.student_id,
    });
  };

  const closeModal = () => {
    setModalState({ type: null, targetId: null, targetScore: 0, targetStudentId: null });
    setRejectReasons([]);
    setCustomReason('');
  };

  const reviewMutation = useReviewDocument();

  const handleApprove = async () => {
    if (!modalState.targetId) return;

    try {
      await reviewMutation.mutateAsync({
        documentId: modalState.targetId,
        data: { action: 'approve' },
      });
      toast.success("Заявка одобрена");
      closeModal();
      await refreshUser();
    } catch (error) {
      toast.error("Ошибка: " + error);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalState.targetId) return;

    const reasonsText = rejectReasons.map(id => {
      const reason = rejectionReasonsList.find(r => r.id === id);
      return reason ? reason.text : '';
    }).filter(Boolean);

    if (reasonsText.length > 0 && customReason.trim() !== '') {
      setCustomReason('');
    }

    const allReasons = customReason.trim()
      ? [customReason.trim()]
      : reasonsText;

    if (allReasons.length === 0) {
      toast.error("Укажите хотя бы одну причину");
      return;
    }

    try {
      await reviewMutation.mutateAsync({
        documentId: modalState.targetId,
        data: { action: 'reject', reasons: allReasons },
      });
      toast.success("Решение по заявке изменено");
      closeModal();
      await refreshUser();
    } catch (error) {
      toast.error("Ошибка: " + error);
    }
  };

  const toggleReason = (reasonId: number) => {
    setRejectReasons(prev =>
      prev.includes(reasonId) ? prev.filter(r => r !== reasonId) : [...prev, reasonId]
    );
  };

  const canApprove = !!(
    user?.roles?.includes('Department') || !user?.roles?.some(r => ['Rectorate', 'Dean'].includes(r))
  );

  const currentGroupName = groupId === 'all'
    ? 'Все группы'
    : (groupsList.find(g => String(g.id) === groupId)?.name || 'Все группы');

  return (
    <>
      <main className="min-h-screen bg-slate-50 pt-24 pb-10">
        <div className="mx-auto max-w-350 px-4 sm:px-5">
          <div className="mb-2 hidden max-[640px]:flex items-center">
            <button
              type="button"
              aria-label="Фильтры"
              onClick={() => setMobileFiltersOpen((prev) => !prev)}
              className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-700 shadow-sm active:scale-95 transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>

          <FilterPanel filters={filters} isRectorate={isRectorate} mobileFiltersOpen={mobileFiltersOpen} />

          <div className="flex overflow-x-auto border-b border-slate-200 pb-1.5 text-xs sm:text-sm">
            <button
              type="button"
              onClick={() => { setActiveTab('my-group'); router.replace('/staff-profile?tab=my-group'); }}
              className={`cursor-pointer inline-flex items-center whitespace-nowrap rounded-l-md px-4 py-2 font-medium transition ${
                activeTab === 'my-group'
                  ? 'bg-sky-700 text-white shadow-sm'
                  : 'bg-slate-100 text-sky-700 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              Группа
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('pending-requests'); router.replace('/staff-profile?tab=pending-requests'); }}
              className={`cursor-pointer inline-flex items-center whitespace-nowrap px-4 py-2 font-medium transition ${
                activeTab === 'pending-requests'
                  ? 'bg-sky-700 text-white shadow-sm'
                  : 'bg-slate-100 text-sky-700 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              Заявки на подтверждение
              {totalRequests > 0 && (
                <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[11px] font-semibold leading-tight text-white">
                  {totalRequests}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('reviewed-requests'); router.replace('/staff-profile?tab=reviewed-requests'); }}
              className={`cursor-pointer inline-flex items-center whitespace-nowrap px-4 py-2 font-medium transition ${
                activeTab === 'reviewed-requests'
                  ? 'bg-sky-700 text-white shadow-sm'
                  : 'bg-slate-100 text-sky-700 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              Рассмотренные заявки
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('statistics'); router.replace('/staff-profile?tab=statistics'); }}
              className={`cursor-pointer inline-flex items-center whitespace-nowrap rounded-r-md px-4 py-2 font-medium transition ${
                activeTab === 'statistics'
                  ? 'bg-sky-700 text-white shadow-sm'
                  : 'bg-slate-100 text-sky-700 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              Статистика
            </button>
          </div>

          {activeTab === 'my-group' && (
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
          )}

          {activeTab === 'pending-requests' && (
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
          )}

          {activeTab === 'reviewed-requests' && (
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
          )}

          {activeTab === 'statistics' && (
            <StatisticsTab
              dynamicStats={dynamicStats}
              currentGroupName={currentGroupName}
              semesterLabel={semesterLabel}
            />
          )}
        </div>
      </main>

      <ModalApprove
        isOpen={modalState.type === 'approve'}
        targetScore={modalState.targetScore}
        onClose={closeModal}
        onConfirm={handleApprove}
      />

      <ModalReject
        isOpen={modalState.type === 'reject'}
        rejectionReasons={rejectionReasonsList}
        selectedReasons={rejectReasons}
        customReason={customReason}
        onToggleReason={toggleReason}
        onCustomReasonChange={setCustomReason}
        onClose={closeModal}
        onSubmit={handleReject}
      />
    </>
  );
}
