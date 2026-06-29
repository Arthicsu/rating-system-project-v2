'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Skeleton } from 'boneyard-js/react';

import { useMySession } from '@/context/AuthContext';
import { useDownloadFile } from '@/hooks/useDownloadFile';
import SearchInput from '@/components/SearchInput';
import CustomSelect from '@/components/CustomSelect';
import Pagination from '@/components/Pagination';
import ExportExcelButton from '@/components/ExportExcelButton';
import ModalApprove from '@/components/modals/modalApprove';
import ModalReject from '@/components/modals/modalReject';
import ModalPreview from '@/components/modals/modalPreview';

import { universityApi, userApi } from '@/lib/apiRequests';
import type { FilterStudentsParams, DashboardStatsParams, ModalState } from '@/interfaces/StaffInterfaces';
import type { RejectionReason, Semester, Group, Document, FacultySimple, StudentSimple, Category as CategoryRating } from '@/interfaces/StaffInterfaces';
import type Student from '@/interfaces/StudentInterfaces';

export default function StaffProfilePage() {
  const { user, refreshUser } = useMySession();
  const router = useRouter();
  const isRectorate = user?.roles?.includes('Rectorate');
  const { downloadFile } = useDownloadFile();
  const [activeTab, setActiveTab] = useState('my-group');
  const [groupsList, setGroupsList] = useState<Group[]>([]);
  const [studentsData, setStudentsData] = useState<Student[]>([]);
  const [pendingDocsData, setPendingDocsData] = useState<Document[]>([]);
  const [reviewedDocsData, setReviewedDocsData] = useState<Document[]>([]);
  const [stats, setStats] = useState({ total_students: 0, avg_score: 0 });
  const [top5Students, setTop5Students] = useState<StudentSimple[]>([]);

  const [modalState, setModalState] = useState<ModalState>({
    type: null,
    targetId: null,
    targetScore: 0,
    targetStudentId: null,
  });

  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);

  const [selectedGroupId, setSelectedGroupId] = useState('all');
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [loadTrigger, setLoadTrigger] = useState(0);
  const [selectedSemesterId, setSelectedSemesterId] = useState(0);
  const [selectedSemesterLabel, setSelectedSemesterLabel] = useState('');
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalStudents, setTotalStudents] = useState(0);
  const [loading, setLoading] = useState(false);
  
  const [requestsPage, setRequestsPage] = useState(1);
  const [totalRequests, setTotalRequests] = useState(0);

  const [reviewedPage, setReviewedPage] = useState(1);
  const [totalReviewed, setTotalReviewed] = useState(0);
  const [reviewedLoading, setReviewedLoading] = useState(false);
  
  const [groupSearchValue, setGroupSearchValue] = useState('');
  const [pendingSearchValue, setPendingSearchValue] = useState('');
  const [reviewedSearchValue, setReviewedSearchValue] = useState('');
  const [modalSourceTab, setModalSourceTab] = useState<'pending' | 'reviewed'>('pending');
  
  const [rejectionReasonsList, setRejectionReasonsList] = useState<RejectionReason[]>([]);
  const [semesterOptions, setSemesterOptions] = useState<Semester[]>([]);
  const [categories, setCategories] = useState<CategoryRating[]>([]);
  const [rejectReasons, setRejectReasons] = useState<number[]>([]);
  const [customReason, setCustomReason] = useState('');
  const [facultiesList, setFacultiesList] = useState<FacultySimple[]>([]);
  const [selectedFacultyId, setSelectedFacultyId] = useState('all');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const pageSize = 20;
  const requestsPageSize = 6;

  useEffect(() => {
    if (user && !user.is_staff) {
      router.replace('/profile');
    }
  }, [user, router]);
  
  const openModal = (type: string, doc: Document, source: 'pending' | 'reviewed' = 'pending') => {
    setModalSourceTab(source);
    setModalState({ 
      type, 
      targetId: doc.id, 
      targetScore: doc.score,
      targetStudentId: doc.student_id 
    });
  };

  const closeModal = () => {
      setModalState({ type: null, targetId: null, targetScore: 0, targetStudentId: null });
      setRejectReasons([]);
      setCustomReason('');
  };
  
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [groupSearchValue]);

  useEffect(() => {
    setRequestsPage(1);
  }, [pendingSearchValue]);

  useEffect(() => {
    setReviewedPage(1);
  }, [reviewedSearchValue]);
  
  const handleGroupChange = (groupId: string) => {
    setSelectedGroupId(groupId);
    setCurrentPage(1);
  };
  
  const handleCourseChange = (courseId: string) => {
    setSelectedCourse(courseId);
    setCurrentPage(1);
    if (courseId === 'all') {
      setSelectedGroupId('all');
    }
    setLoadTrigger(prev => prev + 1);
  };
  
  const handleFacultyChange = (facultyId: string) => {
    setSelectedFacultyId(facultyId);
    setCurrentPage(1);
    if (facultyId === 'all') {
      setSelectedGroupId('all');
    }
    setLoadTrigger(prev => prev + 1);
  };
  
  useEffect(() => {
    const fetchLookups = async () => {
      try {
        const [reasonsRes, semestersRes, catsRes, filtersRes] = await Promise.all([
          universityApi.getRejectionReasons(),
          universityApi.getAcademicYears(),
          userApi.getCategoryAchievements(),
          userApi.getRatingFilters()
        ]);
        
        setRejectionReasonsList(reasonsRes.data);
        setSemesterOptions(semestersRes.data);
        setCategories(catsRes.data);
        setFacultiesList(filtersRes.data.faculties || []);

        const current = semestersRes.data.find((s: Semester) => s.is_current);
        if (current){
          setSelectedSemesterId(current.id);
          setSelectedSemesterLabel(current.label);
        }
      } catch (error) {
        console.error("Ошибка загрузки справочников: ", error);
      }
    };
    fetchLookups();
  }, []);

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const params = {
          course: selectedCourse !== 'all' ? selectedCourse : undefined,
          faculty_id: selectedFacultyId !== 'all' ? selectedFacultyId : undefined,
        };
        
        const groupsRes = await universityApi.getFilteredGroups(params);
        const groups = groupsRes.data || [];
        setGroupsList(groups);
        
        if (selectedCourse === 'all' || selectedFacultyId === 'all') {
          setSelectedGroupId('all');
        } else if (groups.length > 0) {
          const currentStillExists = groups.some(g => g.id === selectedGroupId);
          if (!currentStillExists) {
            setSelectedGroupId(groups[0].id);
          }
        }
      } catch (error) {
        console.error("Ошибка загрузки групп: ", error);
      }
    };
    fetchGroups();
  }, [loadTrigger, selectedCourse, selectedFacultyId]);

  useEffect(() => {
    const fetchDashboard = async () => {
      if (!selectedGroupId || !selectedSemesterId) return;
      setLoading(true);
      setStudentsData([]);

      try {
        const filterParams = {
          faculty_id: selectedFacultyId !== 'all' ? selectedFacultyId : undefined,
          course: selectedCourse !== 'all' ? selectedCourse : undefined,
        };

        const studentsParams: FilterStudentsParams = {
          group_id: selectedGroupId,
          page: currentPage,
          page_size: pageSize,
          search: groupSearchValue || undefined,
          ...filterParams,
        };

        const statsParams: DashboardStatsParams = {
          group_id: selectedGroupId,
          academic_year: String(selectedSemesterId),
          page: requestsPage,
          page_size: requestsPageSize,
          search: pendingSearchValue || undefined,
          ...filterParams,
        };

        const [studentsRes, statsRes] = await Promise.all([
          universityApi.getFilteredStudents(studentsParams),
          universityApi.getFilteredDashboardStats(statsParams)
        ]);

        setStudentsData(studentsRes.data.results || []);
        setTotalStudents(studentsRes.data.count || 0);
        setPendingDocsData(statsRes.data.results || []);
        setTotalRequests(statsRes.data.count || 0);
        setStats(statsRes.data.stats || { total_students: 0, avg_score: 0 });
        setTop5Students(statsRes.data.top5 || []);
        
      } catch (error) {
        console.error("Ошибка загрузки данных дашборда: ", error);
        setStudentsData([]);
        setTotalStudents(0);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, [selectedGroupId, selectedSemesterId, selectedFacultyId, selectedCourse, currentPage, requestsPage, pendingSearchValue, groupSearchValue]);

  const buildFilterParams = useCallback(() => ({
    faculty_id: selectedFacultyId !== 'all' ? selectedFacultyId : undefined,
    course: selectedCourse !== 'all' ? selectedCourse : undefined,
  }), [selectedFacultyId, selectedCourse]);

  const fetchReviewedDocs = useCallback(async () => {
    if (!selectedGroupId || !selectedSemesterId) return;
    setReviewedLoading(true);

    try {
      const res = await universityApi.getFilteredDashboardStats({
        group_id: selectedGroupId,
        academic_year: String(selectedSemesterId),
        page: reviewedPage,
        page_size: requestsPageSize,
        search: reviewedSearchValue || undefined,
        list_type: 'reviewed',
        ...buildFilterParams(),
      });

      setReviewedDocsData(res.data.results || []);
      setTotalReviewed(res.data.count || 0);
    } catch (error) {
      console.error('Ошибка загрузки рассмотренных заявок: ', error);
    } finally {
      setReviewedLoading(false);
    }
  }, [selectedGroupId, selectedSemesterId, reviewedPage, reviewedSearchValue, buildFilterParams]);

  useEffect(() => {
    if (activeTab === 'reviewed-requests') {
      fetchReviewedDocs();
    }
  }, [activeTab, fetchReviewedDocs]);

  const pollPendingRequests = useCallback(async () => {
    if (!selectedGroupId || !selectedSemesterId) return;

    try {
      const statsParams: DashboardStatsParams = {
        group_id: selectedGroupId,
        academic_year: String(selectedSemesterId),
        page: requestsPage,
        page_size: requestsPageSize,
        search: pendingSearchValue || undefined,
        faculty_id: selectedFacultyId !== 'all' ? selectedFacultyId : undefined,
        course: selectedCourse !== 'all' ? selectedCourse : undefined,
      };

      const statsRes = await universityApi.getFilteredDashboardStats(statsParams);

      setPendingDocsData(statsRes.data.results || []);
      setTotalRequests(statsRes.data.count || 0);
      setStats(statsRes.data.stats || { total_students: 0, avg_score: 0 });
      setTop5Students(statsRes.data.top5 || []);
    } catch (error) {
      console.error("Ошибка обновления списка заявок: ", error);
    }
  }, [selectedGroupId, selectedSemesterId, selectedFacultyId, selectedCourse, requestsPage, pendingSearchValue]);

  // Short-polling списка заявок. Пока открыта страница, периодически обновляем только заявки, чтобы они появлялись/исчезали без перезагрузки. На паузе, когда вкладка скрыта.
  useEffect(() => {
    const POLL_INTERVAL_MS = 15_000;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (intervalId === null) {
        intervalId = setInterval(pollPendingRequests, POLL_INTERVAL_MS);
      }
    };
    const stopPolling = () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        pollPendingRequests();
        startPolling();
      }
    };

    if (!document.hidden) startPolling();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      stopPolling();
    };
  }, [pollPendingRequests]);

  const dynamicStats = useMemo(() => {
    const students = studentsData || [];
    const defaults = {
      total_students: stats.total_students,
      avg_score: stats.avg_score,
      max_score: 0,
      min_score: 0,
      active_requests: (pendingDocsData || []).length,
      top5: top5Students,
      categories: {} as Record<string, number>,
    };

    if (students.length === 0) return defaults;

    const scores = students.map(s => s.total_score);
    
    const catStats: Record<string, number> = {};
    categories.forEach(cat => {
      const fieldName = `${cat.code}_score`;
      catStats[cat.label] = students.reduce((acc, s) => acc + ((s[fieldName] as number) || 0), 0);
    });

    return {
      total_students: stats.total_students, 
      avg_score: stats.avg_score,
      max_score: Math.max(...scores),
      min_score: Math.min(...scores),
      active_requests: (pendingDocsData || []).length,
      top5: top5Students,
      categories: catStats
    };
  }, [studentsData, pendingDocsData, categories, stats, top5Students]);

  const handleApprove = async () => {
    if (!modalState.targetId) return;

    try {
      await universityApi.reviewDocument(modalState.targetId, { action: 'approve' });
      toast.success("Заявка одобрена");

      if (modalSourceTab === 'pending') {
        setPendingDocsData(prev => prev.filter(doc => doc.id !== modalState.targetId));
        setTotalRequests(prev => prev - 1);
      } else {
        await fetchReviewedDocs();
      }

      setStudentsData(prev => prev.map(student => {
          if (student.id === modalState.targetStudentId) {
              return { ...student, total_score: student.total_score + modalState.targetScore };
          }
          return student;
      }));

      closeModal();
      await refreshUser();
      router.refresh();
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

    const wasApproved = modalSourceTab === 'reviewed'
      && reviewedDocsData.find(d => d.id === modalState.targetId)?.status_display === 'approved';

    try {
      await universityApi.reviewDocument(modalState.targetId, { 
        action: 'reject', 
        reasons: allReasons 
      });
      toast.success("Решение по заявке изменено");

      if (modalSourceTab === 'pending') {
        setPendingDocsData(prev => prev.filter(doc => doc.id !== modalState.targetId));
        setTotalRequests(prev => prev - 1);
      } else {
        await fetchReviewedDocs();
      }

      if (wasApproved) {
        setStudentsData(prev => prev.map(student => {
          if (student.id === modalState.targetStudentId) {
            return { ...student, total_score: Math.max(0, student.total_score - modalState.targetScore) };
          }
          return student;
        }));
      }

      closeModal();
      await refreshUser();
      router.refresh();
    } catch (error) {
      toast.error("Ошибка: " + error);
    }
  };

  const toggleReason = (reasonId: number) => {
    setRejectReasons(prev => 
      prev.includes(reasonId) ? prev.filter(r => r !== reasonId) : [...prev, reasonId]
    );
  };

  const currentGroupName = selectedGroupId === 'all'
    ? 'Все группы'
    : (groupsList.find(g => String(g.id) === selectedGroupId)?.name || 'Все группы');
    
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

          {mobileFiltersOpen && (
            <div className="mb-3 max-[640px]:block hidden rounded-lg bg-white p-3 shadow-[0_2px_10px_rgba(0,0,0,0.08)] text-[11px] text-sky-700">
              <div className="space-y-2">
                {isRectorate && (
                <CustomSelect
                  id="m-faculty"
                  label="Факультет"
                  value={selectedFacultyId}
                  labelClassName="text-[10px] uppercase tracking-wide text-sky-700"
                  triggerClassName="text-[11px] py-1 px-2"
                  options={[
                    { value: 'all', label: 'Все' },
                    ...facultiesList.map((f) => ({ value: f.id, label: f.short_name })),
                  ]}
                  onChange={(value) => {
                    handleFacultyChange(value);
                    handleCourseChange('all');
                    handleGroupChange('all');
                  }}
                />
                )}
                <CustomSelect
                  id="m-course"
                  label="Курс"
                  value={selectedCourse}
                  labelClassName="text-[10px] uppercase tracking-wide text-sky-700"
                  triggerClassName="text-[11px] py-1 px-2"
                  options={[
                    { value: 'all', label: 'Все' },
                    ...[1, 2, 3, 4, 5].map((c) => ({ value: String(c), label: `${c} курс` })),
                  ]}
                  onChange={handleCourseChange}
                />
                <CustomSelect
                  id="m-group"
                  label="Группа"
                  value={selectedGroupId}
                  labelClassName="text-[10px] uppercase tracking-wide text-sky-700"
                  triggerClassName="text-[11px] py-1 px-2"
                  options={[
                    { value: 'all', label: 'Все' },
                    ...groupsList.map((g) => ({ value: g.id, label: g.name })),
                  ]}
                  onChange={handleGroupChange}
                />
                <CustomSelect
                  id="m-semester"
                  label="Период"
                  value={String(selectedSemesterId)}
                  labelClassName="text-[10px] uppercase tracking-wide text-sky-700"
                  triggerClassName="text-[11px] py-1 px-2"
                  options={semesterOptions.map((opt) => ({
                    value: String(opt.id),
                    label: opt.label,
                  }))}
                  onChange={(value) => {
                    const selected = semesterOptions.find((opt) => opt.id === Number(value));
                    if (selected) {
                      setSelectedSemesterId(selected.id);
                      setSelectedSemesterLabel(selected.label);
                    }
                  }}
                />
              </div>
            </div>
          )}

          <div className="hidden sm:block mb-5 rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.12)] sm:p-5">
            <p className="mb-3 text-xl font-semibold text-slate-900 sm:text-2xl md:text-3xl">
              Фильтры
            </p>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 sm:gap-4">
              {isRectorate && (
              <CustomSelect
                id="faculty-select"
                label="Факультет"
                value={selectedFacultyId}
                labelClassName="block text-[11px] font-medium text-sky-700"
                triggerClassName="text-xs sm:text-sm"
                options={[
                  { value: 'all', label: 'Все факультеты' },
                  ...facultiesList.map((f) => ({ value: f.id, label: f.short_name })),
                ]}
                onChange={(value) => {
                  handleFacultyChange(value);
                  handleCourseChange('all');
                  handleGroupChange('all');
                }}
              />
              )}
              <CustomSelect
                id="course-select"
                label="Курс"
                value={selectedCourse}
                labelClassName="block text-[11px] font-medium text-sky-700"
                triggerClassName="text-xs sm:text-sm"
                options={[
                  { value: 'all', label: 'Все курсы' },
                  ...[1, 2, 3, 4, 5].map((c) => ({ value: String(c), label: `${c} курс` })),
                ]}
                onChange={handleCourseChange}
              />
              <CustomSelect
                id="group-select"
                label="Группа"
                value={selectedGroupId}
                labelClassName="block text-[11px] font-medium text-sky-700"
                triggerClassName="text-xs sm:text-sm"
                options={
                  groupsList.length > 0
                    ? [
                        { value: 'all', label: 'Все группы' },
                        ...groupsList.map((g) => ({ value: g.id, label: g.name })),
                      ]
                    : [{ value: 'all', label: 'Нет групп' }]
                }
                onChange={handleGroupChange}
              />
              <CustomSelect
                id="semester-select"
                label="Период"
                value={String(selectedSemesterId)}
                labelClassName="block text-[11px] font-medium text-sky-700"
                triggerClassName="text-xs sm:text-sm"
                options={semesterOptions.map((opt) => ({
                  value: String(opt.id),
                  label: opt.label,
                }))}
                onChange={(value) => {
                  const selected = semesterOptions.find((opt) => opt.id === Number(value));
                  if (selected) {
                    setSelectedSemesterId(selected.id);
                    setSelectedSemesterLabel(selected.label);
                  }
                }}
              />
            </div>
          </div>

          <div className="flex overflow-x-auto border-b border-slate-200 pb-1.5 text-xs sm:text-sm">
            <button
              type="button"
              onClick={() => setActiveTab('my-group')}
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
              onClick={() => setActiveTab('pending-requests')}
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
              onClick={() => setActiveTab('reviewed-requests')}
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
              onClick={() => setActiveTab('statistics')}
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
            <div className="mt-5">
              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.10)] sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-sm font-semibold text-slate-900 sm:text-base">
                    {selectedGroupId === 'all' ? 'Все студенты' : `Список студентов группы ${currentGroupName}`}{' '}
                    <span className="text-xs font-normal text-sky-700">
                      (всего: {totalStudents})
                    </span>
                  </h2>
                  <div className="flex items-center gap-2">
                    <SearchInput onSearch={setGroupSearchValue} placeholder="Поиск по ФИО или зачетке" />
                    <ExportExcelButton
                      filters={{
                        group_id: selectedGroupId,
                        course: selectedCourse
                      }}
                      page={currentPage}
                    />
                  </div>
                </div>

                <div className="mt-4 rounded-lg bg-white p-2 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
                  <div className="w-full overflow-x-auto">
                    <Skeleton name="staff-students-table" loading={loading}>
                      <table className="min-w-full border-collapse text-xs sm:text-sm" style={{ tableLayout: 'fixed' }}>
                        <thead>
                          <tr className="bg-sky-700 text-white">
                            <th className="w-10 sm:w-14 px-1.5 sm:px-2 md:px-3 lg:px-4 py-1.5 sm:py-2 md:py-2.5 lg:py-3 text-left text-[11px] sm:text-xs md:text-sm lg:text-base font-normal rounded-l-lg">
                            </th>
                            <th className="w-[28%] px-1.5 sm:px-2 md:px-3 lg:px-4 py-1.5 sm:py-2 md:py-2.5 lg:py-3 text-left text-[11px] sm:text-xs md:text-sm lg:text-base font-normal">
                              ФИО студента
                            </th>
                            <th className="w-[18%] px-1.5 sm:px-2 md:px-3 lg:px-4 py-1.5 sm:py-2 md:py-2.5 lg:py-3 text-left text-[11px] sm:text-xs md:text-sm lg:text-base font-normal">
                              Зачетная книжка
                            </th>
                            {isRectorate && (
                              <th className="w-[12%] px-1.5 sm:px-2 md:px-3 lg:px-4 py-1.5 sm:py-2 md:py-2.5 lg:py-3 text-left text-[11px] sm:text-xs md:text-sm lg:text-base font-normal">
                                Факультет
                              </th>
                            )}
                            <th className="w-16 px-1.5 sm:px-2 md:px-3 lg:px-4 py-1.5 sm:py-2 md:py-2.5 lg:py-3 text-center text-[11px] sm:text-xs md:text-sm lg:text-base font-normal">
                              Курс
                            </th>
                            <th className="w-[14%] px-1.5 sm:px-2 md:px-3 lg:px-4 py-1.5 sm:py-2 md:py-2.5 lg:py-3 text-left text-[11px] sm:text-xs md:text-sm lg:text-base font-normal">
                              Группа
                            </th>
                            <th className="w-20 px-1.5 sm:px-2 md:px-3 lg:px-4 py-1.5 sm:py-2 md:py-2.5 lg:py-3 text-center text-[11px] sm:text-xs md:text-sm lg:text-base font-normal">
                              Общий балл
                            </th>
                            <th className="w-20 px-1.5 sm:px-2 md:px-3 lg:px-4 py-1.5 sm:py-2 md:py-2.5 lg:py-3 text-right text-[11px] sm:text-xs md:text-sm lg:text-base font-normal rounded-r-lg">
                              Действия
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {!loading && studentsData.length > 0 ? (
                            studentsData.map((student, idx) => (
                              <tr
                                key={student.id}
                                className="border-b border-[#f0f0f0] last:border-b-0 hover:bg-slate-50"
                              >
                                <td className="p-1 sm:p-2 md:px-4 md:py-3 text-center align-middle">
                                  <div className="mx-auto flex h-4 w-4 sm:h-6 sm:w-6 md:h-8 md:w-8 items-center justify-center rounded-full bg-sky-700 text-[11px] md:text-sm font-bold text-white">
                                    {(currentPage - 1) * pageSize + idx + 1}
                                  </div>
                                </td>
                                <td className="p-1 sm:p-2 md:px-4 md:py-3 text-left text-xs md:text-sm text-[#333] overflow-hidden">
                                  <span className="inline md:hidden block truncate">
                                    {student.short_name}
                                  </span>
                                  <span className="hidden md:inline truncate">{student.full_name}</span>
                                </td>
                                <td className="p-1 sm:p-2 md:px-4 md:py-3 text-left text-xs md:text-sm">
                                  {student.record_book}
                                </td>
                                {isRectorate && (
                                  <td className="p-1 sm:p-2 md:px-4 md:py-3 text-left text-xs md:text-sm">
                                    {student.faculty}
                                  </td>
                                )}
                                <td className="p-1 sm:p-2 md:px-4 md:py-3 text-center text-xs md:text-sm">
                                  {student.course}
                                </td>
                                <td className="p-1 sm:p-2 md:px-4 md:py-3 text-left text-xs md:text-sm">
                                  {student.group}
                                </td>
                                <td className="p-1 sm:p-2 md:px-4 md:py-3 text-center text-xs md:text-sm font-bold text-sky-700">
                                  {student.total_score}
                                </td>
                                <td className="p-1 sm:p-2 md:px-4 md:py-3 text-right text-xs md:text-sm">
                                  <Link
                                    href={`/profile/${student.id}`}
                                    className="font-medium text-gray-700 underline-offset-2 hover:text-sky-900 hover:underline"
                                  >
                                    Профиль
                                  </Link>
                              </td>
                            </tr>
                          ))
                        ) : !loading ? (
                          <tr>
                            <td
                              colSpan={isRectorate ? 8 : 7}
                              className="p-1 sm:p-2 md:px-4 md:py-3 text-center text-xs md:text-sm text-slate-500"
                            >
                              Студенты не найдены
                            </td>
                          </tr>
                        ) : null}
                        </tbody>
                      </table>
                    </Skeleton>
                    
                    <div className="border-t border-slate-200 pt-4">
                      <Pagination
                        page={currentPage}
                        totalCount={totalStudents}
                        pageSize={pageSize}
                        loading={loading}
                        onPageChange={handlePageChange}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'pending-requests' && (
            <div className="mt-5 space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-sm font-semibold text-slate-900 sm:text-base">
                  Заявки: {currentGroupName}, {selectedSemesterLabel}
                </h2>
                <div className="w-full sm:w-64">
                  <SearchInput onSearch={setPendingSearchValue} placeholder="Поиск по ФИО..." />
                </div>
              </div>

              {pendingDocsData && pendingDocsData.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {pendingDocsData.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex flex-col rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-[0_4px_12px_rgba(15,23,42,0.08)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.12)] transition-shadow"
                    >
                      <div className="flex-1 mb-2 flex flex-col gap-1.5">
                        <div className="flex max-[941px]:flex-col items-start justify-between gap-1 sm:gap-2">
                          <div className="flex-1 min-w-0">
                            <Link
                              href={`/profile/${doc.student_id}`}
                              className="text-xs font-semibold text-sky-700 hover:text-sky-900 hover:underline sm:text-sm sm:line-clamp-1"
                            >
                              {doc.student_name}
                            </Link>
                            <p className="text-[10px] text-sky-700 sm:text-xs">{doc.record_book}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs sm:text-xs font-small text-amber-700">
                              {doc.category_display}
                            </span>
                            <span className="rounded-full bg-emerald-100 px-2 py-0.25 text-[10px] font-semibold text-emerald-700 sm:text-xs">
                              +{doc.score}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mb-2">
                        <p className="text-xs text-slate-800 sm:text-sm line-clamp-2">{doc.achievement}</p>
                      </div>

                      <div className="flex items-center justify-between">
                        {doc.files && doc.files.length > 0 && (
                          <span className="text-[10px] text-sky-700 sm:text-xs">
                            <i className="fa-solid fa-file mr-1" />
                            Прикреплённых файл(ов): {doc.files.length}
                          </span>
                        )}
                        {doc.rejection_reason && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700 sm:text-xs">
                            <i className="fa-solid fa-circle-exclamation" />
                            Была отклонена
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setPreviewDoc(doc)}
                          className="cursor-pointer ml-auto text-[10px] font-semibold text-sky-700 hover:text-sky-900 sm:text-xs"
                        >
                          Подробнее
                          {/* <i className="fa-solid fa-arrow-right ml-1" /> */}
                        </button>
                      </div>

                      <div className="mt-3 flex gap-2">
                        {(user?.roles?.includes('Department') || !user?.roles?.some(r => ['Rectorate', 'Dean'].includes(r))) && (
                          <button
                            type="button"
                            onClick={() => openModal('approve', doc)}
                            className="cursor-pointer flex-1 rounded-lg bg-emerald-600 px-2 py-1.5 text-[10px] font-semibold text-white shadow-sm transition hover:bg-emerald-700 sm:text-xs"
                          >
                            Одобрить
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openModal('reject', doc)}
                          className="cursor-pointer flex-1 rounded-lg bg-rose-600 px-2 py-1.5 text-[10px] font-semibold text-white shadow-sm transition hover:bg-rose-700 sm:text-xs sm:px-3 sm:py-2"
                        >
                          Отклонить
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
                  <p className="text-sm text-sky-700">
                    Нет заявок за период &quot;{selectedSemesterLabel}&quot; в группе &quot;{currentGroupName}&quot;
                  </p>
                </div>
              )}
              
              <Pagination
                page={requestsPage}
                totalCount={totalRequests}
                pageSize={requestsPageSize}
                loading={loading}
                onPageChange={setRequestsPage}
              />
            </div>
          )}

          {activeTab === 'reviewed-requests' && (
            <div className="mt-5 space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-sm font-semibold text-slate-900 sm:text-base">
                  Рассмотренные: {currentGroupName}, {selectedSemesterLabel}
                </h2>
                <div className="w-full sm:w-64">
                  <SearchInput onSearch={setReviewedSearchValue} placeholder="Поиск по ФИО..." />
                </div>
              </div>

              {reviewedLoading ? (
                <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
                  <p className="text-sm text-sky-700">Загрузка заявок...</p>
                </div>
              ) : reviewedDocsData.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {reviewedDocsData.map((doc) => {
                    const isApproved = doc.status_display === 'approved';

                    return (
                      <div
                        key={doc.id}
                        className="flex flex-col rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-[0_4px_12px_rgba(15,23,42,0.08)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.12)] transition-shadow"
                      >
                        <div className="flex-1 mb-2 flex flex-col gap-1.5">
                          <div className="flex max-[941px]:flex-col items-start justify-between gap-1 sm:gap-2">
                            <div className="flex-1 min-w-0">
                              <Link
                                href={`/profile/${doc.student_id}`}
                                className="text-xs font-semibold text-sky-700 hover:text-sky-900 hover:underline sm:text-sm sm:line-clamp-1"
                              >
                                {doc.student_name}
                              </Link>
                              <p className="text-[10px] text-sky-700 sm:text-xs">{doc.record_book}</p>
                            </div>
                            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold sm:text-xs ${
                                  isApproved
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-rose-100 text-rose-700'
                                }`}
                              >
                                {isApproved ? 'Подтверждена' : 'Отклонена'}
                              </span>
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-small text-amber-700">
                                {doc.category_display}
                              </span>
                              <span className="rounded-full bg-emerald-100 px-2 py-0.25 text-[10px] font-semibold text-emerald-700 sm:text-xs">
                                +{doc.score}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mb-2">
                          <p className="text-xs text-slate-800 sm:text-sm line-clamp-2">{doc.achievement}</p>
                        </div>

                        {!isApproved && doc.rejection_reason && (
                          <p className="mb-2 text-[10px] text-rose-600 sm:text-xs line-clamp-2">
                            Причина: {doc.rejection_reason}
                          </p>
                        )}

                        <div className="flex items-center justify-between">
                          {doc.files && doc.files.length > 0 && (
                            <span className="text-[10px] text-sky-700 sm:text-xs">
                              <i className="fa-solid fa-file mr-1" />
                              Файлов: {doc.files.length}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setPreviewDoc(doc)}
                            className="cursor-pointer ml-auto text-[10px] font-semibold text-sky-700 hover:text-sky-900 sm:text-xs"
                          >
                            Подробнее
                          </button>
                        </div>

                        <div className="mt-3 flex gap-2">
                          {!isApproved && (
                            <button
                              type="button"
                              onClick={() => openModal('approve', doc, 'reviewed')}
                              className="cursor-pointer flex-1 rounded-lg bg-emerald-600 px-2 py-1.5 text-[10px] font-semibold text-white shadow-sm transition hover:bg-emerald-700 sm:text-xs"
                            >
                              Одобрить
                            </button>
                          )}
                          {isApproved && (
                            <button
                              type="button"
                              onClick={() => openModal('reject', doc, 'reviewed')}
                              className="cursor-pointer flex-1 rounded-lg bg-rose-600 px-2 py-1.5 text-[10px] font-semibold text-white shadow-sm transition hover:bg-rose-700 sm:text-xs sm:px-3 sm:py-2"
                            >
                              Отклонить
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
                  <p className="text-sm text-sky-700">
                    Нет рассмотренных заявок за период &quot;{selectedSemesterLabel}&quot; в группе &quot;{currentGroupName}&quot;
                  </p>
                </div>
              )}

              <Pagination
                page={reviewedPage}
                totalCount={totalReviewed}
                pageSize={requestsPageSize}
                loading={reviewedLoading}
                onPageChange={setReviewedPage}
              />
            </div>
          )}

          {activeTab === 'statistics' && (
            <div className="mt-5">
              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.10)] sm:p-5">
                <h2 className="mb-5 text-sm font-semibold text-slate-900 sm:text-base">
                  Аналитика: {currentGroupName}{' '}
                  <span className="text-xs font-normal text-sky-700 sm:text-sm">
                    ({selectedSemesterLabel})
                  </span>
                </h2>

                <div className="mb-6 grid gap-3 grid-cols-2 md:grid-cols-4">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5 sm:p-4">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-sky-700">
                      Студентов
                    </div>
                    <div className="mt-1 text-2xl font-bold text-sky-700">
                      {dynamicStats.total_students}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5 sm:p-4">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-sky-700">
                      Средний балл
                    </div>
                    <div className="mt-1 text-2xl font-bold text-sky-700">
                      {dynamicStats.avg_score}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5 sm:p-4">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-sky-700">
                      Максимальный / Минимальный
                    </div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">
                      {dynamicStats.max_score}{' '}
                      <span className="mx-1 text-slate-300">|</span>
                      {dynamicStats.min_score}
                    </div>
                  </div>
                  <div className="rounded-2xl border-l-4 border-rose-500 bg-rose-50 p-3.5 sm:p-4">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-rose-600">
                      Активные заявки
                    </div>
                    <div className="mt-1 text-2xl font-bold text-rose-600">
                      {dynamicStats.active_requests}
                    </div>
                  </div>
                </div>

                <div className="grid gap-5 grid-cols-1 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:p-5">
                    <h3 className="mb-4 border-b border-slate-200 pb-2 text-sm font-semibold text-slate-900">
                      Распределение баллов по группе
                    </h3>
                    <div className="space-y-3">
                      {Object.entries(dynamicStats.categories).map(
                        ([label, value]) => {
                          const percentage =
                            dynamicStats.avg_score > 0
                              ? Math.min(
                                  (value /
                                    (dynamicStats.avg_score *
                                      dynamicStats.total_students)) *
                                    100,
                                  100
                                )
                              : 0;
                          return (
                            <div key={label as string}>
                              <div className="mb-1 flex items-center justify-between text-[13px] text-slate-800">
                                <span>{label as string}</span>
                                <strong className="text-slate-900">
                                  {value} б.
                                </strong>
                              </div>
                              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                                <div
                                  className="h-full rounded-full bg-sky-700 transition-[width] duration-300"
                                  style={{
                                    width: `${percentage || 0}%`,
                                  }}
                                />
                              </div>
                            </div>
                          );
                        }
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:p-5">
                    <h3 className="mb-4 border-b border-slate-200 pb-2 text-sm font-semibold text-slate-900">
                      Топ-5 студентов по баллам
                    </h3>
                    <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white">
                      <table className="min-w-full text-left text-[13px] text-sky-700">
                        <thead className="bg-sky-700 text-[11px] font-semibold uppercase tracking-wide text-slate-100">
                          <tr>
                            <th className="px-4 py-2.5">Место</th>
                            <th className="px-4 py-2.5">ФИО</th>
                            <th className="px-4 py-2.5">Балл</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dynamicStats.top5.map((student, idx) => (
                            <tr
                              key={student.id}
                              className="border-t border-slate-100 hover:bg-slate-50/70"
                            >
                              <td className="px-4 py-2.5">
                                <span className="inline-flex min-w-[2.2rem] justify-center rounded-md bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">
                                  {idx + 1}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-sm text-slate-900">
                                {student.full_name}
                              </td>
                              <td className="px-4 py-2.5 text-sm font-semibold text-sky-700">
                                {student.total_score}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
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

      <ModalPreview
        isOpen={!!previewDoc}
        doc={previewDoc}
        onClose={() => setPreviewDoc(null)}
        onDownload={(fileId, fileName) => downloadFile(fileId, fileName)}
      />
    </>
  );
}