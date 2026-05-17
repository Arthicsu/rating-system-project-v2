'use client';

import { useState, useMemo, useEffect } from 'react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Skeleton } from 'boneyard-js/react';

import { useMySession } from '@/context/AuthContext';
import { useDownloadFile } from '@/hooks/useDownloadFile';
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
  
  const [searchTerm, setSearchTerm] = useState('');
  const [requestsSearchTerm, setRequestsSearchTerm] = useState('');
  
  const [rejectionReasonsList, setRejectionReasonsList] = useState<RejectionReason[]>([]);
  const [semesterOptions, setSemesterOptions] = useState<Semester[]>([]);
  const [categories, setCategories] = useState<CategoryRating[]>([]);
  const [rejectReasons, setRejectReasons] = useState<number[]>([]);
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

  const openModal = (type: string, doc: Document) => setModalState({ 
      type, 
      targetId: doc.id, 
      targetScore: doc.score,
      targetStudentId: doc.student_id 
  });

  const closeModal = () => {
      setModalState({ type: null, targetId: null, targetScore: 0, targetStudentId: null });
      setRejectReasons([]); 
  };
  
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };
  
  const handleGroupChange = (groupId: string) => {
    setSelectedGroupId(groupId);
    setCurrentPage(1);
  };
  
  const handleCourseChange = (courseId: string) => {
    setSelectedCourse(courseId);
    if (courseId === 'all') {
      setSelectedGroupId('all');
    }
    setLoadTrigger(prev => prev + 1);
  };
  
  const handleFacultyChange = (facultyId: string) => {
    setSelectedFacultyId(facultyId);
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

  /* eslint-disable react-hooks/exhaustive-deps */
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
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    const fetchDashboard = async () => {
      if (!selectedGroupId || !selectedSemesterId) return; 
      setLoading(true);
      
      try {
        const studentsParams: FilterStudentsParams = {
          group_id: selectedGroupId,
          page: currentPage,
          page_size: pageSize,
        };

        const statsParams: DashboardStatsParams = {
          group_id: selectedGroupId,
          academic_year: String(selectedSemesterId),
          page: requestsPage,
          page_size: requestsPageSize,
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
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, [selectedGroupId, selectedSemesterId, currentPage, selectedCourse, requestsPage]);

  const filteredStudents = useMemo(() => {
    let students = studentsData || [];
    if (searchTerm.trim() !== '') {
      const lowerTerm = searchTerm.toLowerCase();
      students = students.filter(s => 
        s.full_name.toLowerCase().includes(lowerTerm) || 
        (s.record_book && s.record_book.toLowerCase().includes(lowerTerm))
      );
    }
    return students;
  }, [studentsData, searchTerm]);

  const filteredDocs = useMemo(() => {
    let docs = pendingDocsData || [];
    if (requestsSearchTerm.trim() !== '') {
      const lowerTerm = requestsSearchTerm.toLowerCase();
      docs = docs.filter(d =>
        d.student_name.toLowerCase().includes(lowerTerm)
      );
    }
    return docs;
  }, [pendingDocsData, requestsSearchTerm]);

  const dynamicStats = useMemo(() => {
    const students = filteredStudents || [];
    const defaults = {
      total_students: stats.total_students,
      avg_score: stats.avg_score,
      max_score: 0,
      min_score: 0,
      active_requests: filteredDocs.length,
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
      active_requests: filteredDocs.length,
      top5: top5Students,
      categories: catStats
    };
  }, [filteredStudents, filteredDocs, categories, stats, top5Students]);

  const handleApprove = async () => {
    if (!modalState.targetId) return;

    try {
      await universityApi.reviewDocument(modalState.targetId, { action: 'approve' });

      setPendingDocsData(prev => prev.filter(doc => doc.id !== modalState.targetId));
      setTotalRequests(prev => prev - 1);
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

    if (rejectReasons.length === 0) {
      toast.error("Выберите хотя бы одну причину");
      return;
    }

    const reasonsText = rejectReasons.map(id => {
      const reason = rejectionReasonsList.find(r => r.id === id);
      return reason ? reason.text : '';
    }).filter(Boolean);

    try {
      await universityApi.reviewDocument(modalState.targetId, { 
        action: 'reject', 
        reasons: reasonsText 
      });

      setPendingDocsData(prev => prev.filter(doc => doc.id !== modalState.targetId));
      setTotalRequests(prev => prev - 1);

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
            <div className="mb-3 max-[640px]:block hidden rounded-lg bg-white p-3 shadow-[0_2px_10px_rgba(0,0,0,0.08)] text-[11px] text-slate-700">
              <div className="space-y-2">
                {isRectorate && (
                <div className="flex flex-col gap-1">
                  <label htmlFor="m-faculty" className="text-[10px] uppercase tracking-wide text-slate-500">Факультет</label>
                  <select
                    id="m-faculty"
                    value={selectedFacultyId}
                    onChange={(e) => {
                      handleFacultyChange(e.target.value);
                      handleCourseChange('all');
                      handleGroupChange('all');
                    }}
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] outline-none focus:border-sky-700 focus:ring-1 focus:ring-sky-700"
                  >
                    <option value="all">Все</option>
                    {facultiesList.map(f => (
                      <option key={f.id} value={f.id}>{f.short_name}</option>
                    ))}
                  </select>
                </div>
                )}
                <div className="flex flex-col gap-1">
                  <label htmlFor="m-course" className="text-[10px] uppercase tracking-wide text-slate-500">Курс</label>
                  <select
                    id="m-course"
                    value={selectedCourse}
                    onChange={(e) => handleCourseChange(e.target.value)}
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] outline-none focus:border-sky-700 focus:ring-1 focus:ring-sky-700"
                  >
                    <option value="all">Все</option>
                    {[1, 2, 3, 4, 5].map(c => (
                      <option key={c} value={String(c)}>{c} курс</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="m-group" className="text-[10px] uppercase tracking-wide text-slate-500">Группа</label>
                  <select
                    id="m-group"
                    value={selectedGroupId}
                    onChange={(e) => handleGroupChange(e.target.value)}
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] outline-none focus:border-sky-700 focus:ring-1 focus:ring-sky-700"
                  >
                    <option value="all">Все</option>
                    {groupsList.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="m-semester" className="text-[10px] uppercase tracking-wide text-slate-500">Период</label>
                  <select
                    id="m-semester"
                    value={selectedSemesterId}
                    onChange={(e) => {
                      const selected = semesterOptions.find(opt => opt.id === Number(e.target.value));
                      if (selected) {
                        setSelectedSemesterId(selected.id);
                        setSelectedSemesterLabel(selected.label);
                      }
                    }}
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] outline-none focus:border-sky-700 focus:ring-1 focus:ring-sky-700"
                  >
                    {semesterOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="hidden sm:block mb-5 rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.12)] sm:p-5">
            <p className="mb-3 text-xl font-semibold text-slate-900 sm:text-2xl md:text-3xl">
              Фильтры
            </p>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 sm:gap-4">
              {isRectorate && (
              <div className="space-y-1.5">
                <label htmlFor="faculty-select" className="block text-[11px] font-medium text-slate-500">Факультет</label>
                <select
                  id="faculty-select"
                  className="w-full min-w-28 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-sm outline-none ring-sky-500/0 transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/70 sm:text-sm"
                  value={selectedFacultyId}
                  onChange={(e) => {
                    handleFacultyChange(e.target.value);
                    handleCourseChange('all');
                    handleGroupChange('all');
                  }}
                >
                  <option value="all">Все факультеты</option>
                  {facultiesList.map(f => (
                    <option key={f.id} value={f.id}>{f.short_name}</option>
                  ))}
                </select>
              </div>
              )}
              <div className="space-y-1.5">
                <label htmlFor="course-select" className="block text-[11px] font-medium text-slate-500">Курс</label>
                <select
                  id="course-select"
                  className="w-full min-w-28 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-sm outline-none ring-sky-500/0 transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/70 sm:text-sm"
                  value={selectedCourse}
                  onChange={(e) => handleCourseChange(e.target.value)}
                >
                  <option value="all">Все курсы</option>
                  {[1, 2, 3, 4, 5].map((c) => (
                    <option key={c} value={String(c)}>{c} курс</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="group-select" className="block text-[11px] font-medium text-slate-500">Группа</label>
                <select
                  id="group-select"
                  className="w-full min-w-35 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-sm outline-none ring-sky-500/0 transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/70 sm:text-sm"
                  value={selectedGroupId}
                  onChange={(e) => handleGroupChange(e.target.value)}
                >
                  {groupsList.length > 0 && (
                    <option value="all">Все группы</option>
                  )}
                  {groupsList.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                  {groupsList.length === 0 && <option value="all">Нет групп</option>}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="semester-select" className="block text-[11px] font-medium text-slate-500">Период</label>
                <select
                  id="semester-select"
                  className="w-full min-w-40 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-sm outline-none ring-sky-500/0 transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/70 sm:text-sm"
                  value={selectedSemesterId}
                  onChange={(e) => {
                    const selected = semesterOptions.find(opt => opt.id === Number(e.target.value));
                    if (selected) {
                      setSelectedSemesterId(selected.id);
                      setSelectedSemesterLabel(selected.label);
                    }
                  }}
                >
                  {semesterOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex overflow-x-auto border-b border-slate-200 pb-1.5 text-xs sm:text-sm">
            <button
              type="button"
              onClick={() => setActiveTab('my-group')}
              className={`cursor-pointer inline-flex items-center whitespace-nowrap rounded-l-md px-4 py-2 font-medium transition ${
                activeTab === 'my-group'
                  ? 'bg-slate-500 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              Группа
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('pending-requests')}
              className={`cursor-pointer inline-flex items-center whitespace-nowrap px-4 py-2 font-medium transition ${
                activeTab === 'pending-requests'
                  ? 'bg-slate-500 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              Заявки на подтверждение
              {totalRequests > 0 && (
                <span className="ml-1 inline-flex min-w-6 items-center justify-center rounded-full bg-rose-600 px-1.5 text-[11px] font-semibold leading-tight text-white">
                  {totalRequests}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('statistics')}
              className={`cursor-pointer inline-flex items-center whitespace-nowrap rounded-r-md px-4 py-2 font-medium transition ${
                activeTab === 'statistics'
                  ? 'bg-slate-500 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-900'
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
                    Список студентов группы {currentGroupName}{' '}
                    <span className="text-xs font-normal text-slate-500">
                      (всего: {totalStudents})
                    </span>
                  </h2>
                  <div className="flex items-center gap-2">
                    <div className="relative flex items-center">
                      <i className="fa-solid fa-magnifying-glass pointer-events-none absolute left-3 text-[11px] text-slate-400" />
                      <input
                        type="text"
                        className="w-55 rounded-full border border-slate-200 bg-white py-1.5 pl-7 pr-3 text-xs text-slate-900 placeholder:text-sm placeholder:text-slate-400 outline-none ring-sky-500/0 transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/70 sm:text-sm"
                        placeholder="Поиск по ФИО или зачетке"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <ExportExcelButton
                      filters={{
                        group_id: selectedGroupId,
                        course: selectedCourse
                      }}
                      page={currentPage}
                    />
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
                  <Skeleton name="staff-students-table" loading={false}>
                    <table className="min-w-full text-left text-xs text-slate-500 sm:text-sm">
                      <thead className="bg-slate-500 text-[11px] font-semibold uppercase tracking-wide text-slate-100">
                        <tr>
                          <th className="w-12 px-3 py-2.5 text-center font-normal sm:w-16">
                          </th>
                          <th className="px-4 py-2.5">ФИО студента</th>
                          <th className="px-4 py-2.5">Зачетная книжка</th>
                          <th className="px-4 py-2.5">Общий балл</th>
                          <th className="px-4 py-2.5 text-right">Действия</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.length > 0 ? (
                          filteredStudents.map((student, idx) => (
                            <tr
                              key={student.id}
                              className="border-t border-slate-100 hover:bg-slate-50/70"
                            >
                              <td className="px-3 py-2.5 text-center">
                                <div className="mx-auto flex h-4 w-4 items-center justify-center rounded-full bg-sky-700 text-[11px] font-bold text-white sm:h-6 sm:w-6 md:h-7.5 md:w-7.5 md:text-sm">
                                  {idx + 1}
                                </div>
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="text-xs sm:text-sm">
                                  {student.full_name}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-xs text-slate-500 sm:text-sm">
                                {student.record_book}
                              </td>
                              <td className="px-4 py-2.5 text-xs font-semibold text-sky-700 sm:text-sm">
                                {student.total_score}
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <Link
                                  href={`/profile/${student.id}`}
                                  className="text-xs font-medium text-gray-700 underline-offset-2 hover:text-sky-900 hover:underline sm:text-sm"
                                >
                                  Профиль
                                </Link>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-4 py-6 text-center text-xs text-slate-500 sm:text-sm"
                          >
                            Студенты не найдены
                          </td>
                        </tr>
                      )}
                      </tbody>
                    </table>
                  </Skeleton>
                </div>
                
                <Pagination
                  page={currentPage}
                  totalCount={totalStudents}
                  pageSize={pageSize}
                  loading={loading}
                  onPageChange={handlePageChange}
                />
              </div>
            </div>
          )}

          {activeTab === 'pending-requests' && (
            <div className="mt-5 space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-sm font-semibold text-slate-900 sm:text-base">
                  Заявки: {currentGroupName}, {selectedSemesterLabel}
                </h2>
                <div className="relative w-full sm:w-64">
                  <i className="fa-solid fa-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400" />
                  <input
                    type="text"
                    className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-7 pr-3 text-xs text-slate-900 placeholder:text-sm placeholder:text-slate-400 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/70 sm:text-sm"
                    placeholder="Поиск по ФИО..."
                    value={requestsSearchTerm}
                    onChange={(e) => setRequestsSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {filteredDocs.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex flex-col rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-[0_4px_12px_rgba(15,23,42,0.08)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.12)] transition-shadow"
                    >
                      <div className="flex-1 mb-2 flex flex-col gap-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <Link
                              href={`/profile/${doc.student_id}`}
                              className="text-xs font-semibold text-sky-700 hover:text-sky-900 hover:underline sm:text-sm line-clamp-1"
                            >
                              {doc.student_name}
                            </Link>
                            <p className="text-[10px] text-slate-500 sm:text-xs">{doc.record_book}</p>
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
                          <span className="text-[10px] text-slate-500 sm:text-xs">
                            <i className="fa-solid fa-file mr-1" />
                            Прикреплённых файл(ов): {doc.files.length}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setPreviewDoc(doc)}
                          className="cursor-pointer ml-auto text-[10px] text-sky-600 hover:text-sky-800 sm:text-xs"
                        >
                          Подробнее <i className="fa-solid fa-arrow-right ml-1" />
                        </button>
                      </div>

                      {doc.rejection_reason && (
                        <div className="mb-2 rounded bg-rose-50 p-2 text-[10px] text-rose-700 sm:text-xs">
                          <i className="fa-solid fa-circle-exclamation mr-1" />
                          <span className="font-medium">Причина:</span> {doc.rejection_reason}
                        </div>
                      )}

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
                  <p className="text-sm text-slate-500">
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

          {activeTab === 'statistics' && (
            <div className="mt-5">
              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.10)] sm:p-5">
                <h2 className="mb-5 text-sm font-semibold text-slate-900 sm:text-base">
                  Аналитика: {currentGroupName}{' '}
                  <span className="text-xs font-normal text-slate-500 sm:text-sm">
                    ({selectedSemesterLabel})
                  </span>
                </h2>

                <div className="mb-6 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5 sm:p-4">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      Студентов
                    </div>
                    <div className="mt-1 text-2xl font-bold text-sky-700">
                      {dynamicStats.total_students}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5 sm:p-4">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      Средний балл
                    </div>
                    <div className="mt-1 text-2xl font-bold text-sky-700">
                      {dynamicStats.avg_score}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5 sm:p-4">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
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

                <div className="grid gap-5 grid-cols-2 md:grid-cols-2">
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
                    <div className="overflow-hidden rounded-xl border border-slate-100 bg-white">
                      <table className="min-w-full text-left text-[13px] text-slate-500">
                        <thead className="bg-slate-500 text-[11px] font-semibold uppercase tracking-wide text-slate-100">
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
        onToggleReason={toggleReason}
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