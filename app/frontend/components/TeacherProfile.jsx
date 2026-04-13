`use client`;
import { useState, useMemo, useEffect } from 'react';
import api from '@/lib/axios';
import Pagination from '@/components/Pagination';

export default function TeacherProfile({profile, isOwner}) {
  const [activeTab, setActiveTab] = useState(`my-group`);
  const [groupsList, setGroupsList] = useState([]);
  const [studentsData, setStudentsData] = useState([]);
  const [pendingDocsData, setPendingDocsData] = useState([]);
  const [stats, setStats] = useState({ total_students: 0, avg_score: 0 });

  const [modalState, setModalState] = useState({
    type: null,
    targetId: null,
    targetScore: 0,
    targetStudentId: null
  });

  const [selectedGroupId, setSelectedGroupId] = useState('all');
  const [selectedSemesterId, setSelectedSemesterId] = useState('');
  const [selectedSemesterLabel, setSelectedSemesterLabel] = useState('');
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalStudents, setTotalStudents] = useState(0);
  const [loading, setLoading] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [requestsSearchTerm, setRequestsSearchTerm] = useState('');
  
  const [rejectionReasonsList, setRejectionReasonsList] = useState([]);
  const [semesterOptions, setSemesterOptions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [rejectReasons, setRejectReasons] = useState([]);
  const [pageSize] = useState(20);

  const openModal = (type, doc) => setModalState({ 
      type, 
      targetId: doc.id, 
      targetScore: doc.score,
      targetStudentId: doc.student_id 
  });

  const closeModal = () => {
      setModalState({ type: null, targetId: null, targetScore: 0, targetStudentId: null });
      setRejectReasons([]); 
  };
  
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };
  
  const handleGroupChange = (groupId) => {
    setSelectedGroupId(groupId);
    setCurrentPage(1);
  };
  
  useEffect(() => {
    const fetchLookups = async () => {
      try {
        const [reasonsRes, semestersRes, catsRes, groupsRes] = await Promise.all([
          api.get('/university/api/v1/rejection-reasons/'),
          api.get('/university/api/v1/academic-years/'),
          api.get('/user/api/v1/category-achievements/'),
          api.get('/university/api/v1/filtered-groups/')
        ]);
        
        setRejectionReasonsList(reasonsRes.data);
        setSemesterOptions(semestersRes.data);
        setCategories(catsRes.data);
        setGroupsList(groupsRes.data || []);

        const current = semestersRes.data.find(s => s.is_current);
        if (current){
          setSelectedSemesterId(current.id);
          setSelectedSemesterLabel(current.label);
        }
        
        if (groupsRes.data && groupsRes.data.length > 0) {
          setSelectedGroupId(groupsRes.data[0].id);
        }
      } catch (error) {
        console.error("Ошибка загрузки справочников: ", error);
      }
    };
    fetchLookups();
  }, []);

  useEffect(() => {
    const fetchDashboard = async () => {
      if (!selectedGroupId || !selectedSemesterId) return; 
      setLoading(true);
      
      try {
        const params = new URLSearchParams();
        params.append('group_id', selectedGroupId);
        params.append('page', currentPage);
        params.append('page_size', pageSize);

        const statsParams = new URLSearchParams();
        statsParams.append('group_id', selectedGroupId);
        statsParams.append('academic_year', selectedSemesterId);
        const [studentsRes, statsRes] = await Promise.all([
          api.get('/university/api/v1/filtered-students/', { params } ),
          api.get('/university/api/v1/filtered-dashboard-stats/', { params: statsParams })
        ]);

        setStudentsData(studentsRes.data.results);
        setTotalStudents(studentsRes.data.count);
        setPendingDocsData(statsRes.data.pending_documents);
        setStats(statsRes.data.stats);
        
      } catch (error) {
        console.error("Ошибка загрузки данных дашборда: ", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, [selectedGroupId, selectedSemesterId, currentPage]);

  const filteredStudents = useMemo(() => {
    let students = studentsData;
    if (searchTerm.trim() != '') {
      const lowerTerm = searchTerm.toLowerCase();
      students = students.filter(s => 
        s.full_name.toLowerCase().includes(lowerTerm) || 
        (s.record_book && s.record_book.toLowerCase().includes(lowerTerm))
      );
    }
    return students;
  }, [studentsData, searchTerm]);

  const filteredDocs = useMemo(() => {
    let docs = pendingDocsData;
    if (requestsSearchTerm.trim() != '') {
      const lowerTerm = requestsSearchTerm.toLowerCase();
      docs = docs.filter(d =>
        d.student_name.toLowerCase().includes(lowerTerm)
      );
    }
    return docs;
  }, [pendingDocsData, requestsSearchTerm]);

  const dynamicStats = useMemo(() => {
    const students = filteredStudents;
    const defaults = {
      total_students: stats.total_students,
      avg_score: stats.avg_score,
      max_score: 0,
      min_score: 0,
      active_requests: filteredDocs.length,
      top5: [],
      categories: {}
    };

    if (students.length == 0) return defaults;

    const scores = students.map(s => s.total_score);
    
    const catStats = {};
    categories.forEach(cat => {
      const fieldName = `${cat.code}_score`;
      catStats[cat.label] = students.reduce((acc, s) => acc + (s[fieldName] || 0), 0);
    });

    return {
      total_students: stats.total_students, 
      avg_score: stats.avg_score,
      max_score: Math.max(...scores),
      min_score: Math.min(...scores),
      active_requests: filteredDocs.length,
      top5: [...students].sort((a, b) => b.total_score - a.total_score).slice(0, 5),
      categories: catStats
    };
  }, [filteredStudents, filteredDocs, categories, stats]);

  const handleApprove = async () => {
    if (!modalState.targetId) return;

    try {
      await api.post(`/university/api/v1/document/${modalState.targetId}/review/`, {
        action: 'approve'
      });

      setPendingDocsData(prev => prev.filter(doc => doc.id != modalState.targetId));
      setStudentsData(prev => prev.map(student => {
          if (student.id == modalState.targetStudentId) {
              return { ...student, total_score: student.total_score + modalState.targetScore };
          }
          return student;
      }));

      closeModal();
    } catch (error) {
      alert("Ошибка: " + error);
    }
  };

  const handleReject = async (e) => {
    e.preventDefault();
    if (!modalState.targetId) return;

    if (rejectReasons.length == 0) {
      alert("Выберите хотя бы одну причину");
      return;
    }

    const reasonsText = rejectReasons.map(id => {
      const reason = rejectionReasonsList.find(r => r.id === id);
      return reason ? reason.text : '';
    }).filter(Boolean);

    try {
      await api.post(`/university/api/v1/document/${modalState.targetId}/review/`, {
        action: 'reject',
        reasons: reasonsText
      });

      setPendingDocsData(prev => prev.filter(doc => doc.id != modalState.targetId));

      closeModal();
    } catch (error) {
      alert("Ошибка: " + error);
    }
  };

  const toggleReason = (reason) => {
    setRejectReasons(prev => 
      prev.includes(reason) ? prev.filter(r => r != reason) : [...prev, reason]
    );
  };

  const currentGroupName = selectedGroupId == 'all'
    ? 'Все группы'
    : (groupsList.find(g => String(g.id) == String(selectedGroupId))?.name || 'Все группы');
    
  const downloadFile = async (fileId, fileName) => {
    try {
      const response = await api.get(`/student/api/v1/document/download/${fileId}/`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Ошибка скачивания файла:', error);
    }
  };
    
  return (
    <>
      <main className="min-h-screen bg-slate-50 pt-24 pb-10">
        <div className="mx-auto max-w-350 px-4 sm:px-5">
          {/* Фильтры */}
          <div className="mb-5 rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.12)] sm:p-5">
            <p className="mb-3 text-xl font-semibold text-slate-900 sm:text-2xl md:text-3xl">
              Фильтры
            </p>
            <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-slate-500">
                  Группа
                </label>
                <select
                  className="w-full min-w-35 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-sm outline-none ring-sky-500/0 transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/70 sm:text-sm"
                  value={selectedGroupId}
                  onChange={(e) => handleGroupChange(e.target.value)}
                >
                  {groupsList.length > 0 && (
                    <option value="all">Все группы</option>
                  )}
                  {groupsList.map((g) => (
                    <option key={g.id} value={String(g.id)}>
                      {g.name} ({g.academic_year})
                    </option>
                  ))}
                  {groupsList.length == 0 && <option value="all">Нет групп</option>}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-slate-500">
                  Период
                </label>
                <select
                  className="w-full min-w-40 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-sm outline-none ring-sky-500/0 transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/70 sm:text-sm"
                  value={selectedSemesterId}
                  onChange={(e) => {
                    const selected = semesterOptions.find(opt => opt.id == e.target.value);
                    setSelectedSemesterId(selected.id);
                    setSelectedSemesterLabel(selected.label);
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

          {/* Табы */}
          <div className="flex overflow-x-auto border-b border-slate-200 pb-1.5 text-xs sm:text-sm">
            <button
              type="button"
              onClick={() => setActiveTab(`my-group`)}
              className={`inline-flex items-center whitespace-nowrap rounded-l-md px-4 py-2 font-medium transition ${
                activeTab == `my-group`
                  ? 'bg-slate-500 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              Моя группа
            </button>
            <button
              type="button"
              onClick={() => setActiveTab(`pending-requests`)}
              className={`inline-flex items-center whitespace-nowrap px-4 py-2 font-medium transition ${
                activeTab == `pending-requests`
                  ? 'bg-slate-500 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              Заявки на подтверждение
              {filteredDocs.length > 0 && (
                <span className="ml-1 inline-flex min-w-6 items-center justify-center rounded-full bg-rose-600 px-1.5 text-[11px] font-semibold leading-tight text-white">
                  {filteredDocs.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab(`statistics`)}
              className={`inline-flex items-center whitespace-nowrap rounded-r-md px-4 py-2 font-medium transition ${
                activeTab == `statistics`
                  ? 'bg-slate-500 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              Статистика
            </button>
          </div>

          {/* Контент вкладок */}
          {activeTab == `my-group` && (
            <div className="mt-5">
              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.10)] sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-sm font-semibold text-slate-900 sm:text-base">
                    Список студентов группы {currentGroupName}{' '}
                    <span className="text-xs font-normal text-slate-500">
                      (всего: {totalStudents})
                    </span>
                  </h2>
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
                </div>

                <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
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
                              {student.record_book || '—'}
                            </td>
                            <td className="px-4 py-2.5 text-xs font-semibold text-sky-700 sm:text-sm">
                              {student.total_score}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <a
                                href={`/profile/${student.id}`}
                                className="text-xs font-medium text-gray-700 underline-offset-2 hover:text-sky-900 hover:underline sm:text-sm"
                              >
                                Профиль
                              </a>
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

          {activeTab == `pending-requests` && (
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
                <div className="grid gap-4 md:grid-cols-1 xl:grid-cols-2">
                  {filteredDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_4px_12px_rgba(15,23,42,0.08)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.12)] transition-shadow"
                    >
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {doc.student_name}
                          </p>
                          <p className="text-xs text-slate-500">{doc.record_book}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            +{doc.score}
                          </span>
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                            {doc.category_display}
                          </span>
                        </div>
                      </div>

                      <div className="mb-3">
                        <p className="text-sm text-slate-800">{doc.achievement}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                            {doc.sub_type_display}
                          </span>
                          {doc.level_display && doc.level_display !== 'None' && (
                            <span className="rounded bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">
                              {doc.level_display}
                            </span>
                          )}
                          {doc.result_display && doc.result_display !== 'None' && (
                            <span className="rounded bg-purple-50 px-2 py-0.5 text-[11px] text-purple-700">
                              {doc.result_display}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* временно */}
                      <div className="mb-3 flex items-center gap-4 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <i className="fa-regular fa-calendar-check" />
                          Дата получения: {new Date(doc.date_received).toLocaleDateString('ru-RU')}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <i className="fa-regular fa-calendar" />
                          Дата загрузки: {new Date(doc.uploaded_at).toLocaleDateString('ru-RU')}
                        </span>
                      </div>
                      <div className="mb-3 flex items-center gap-4 text-xs text-slate-500">
                        {doc.files && doc.files.length > 0 ? (
                          doc.files.map((file, index) => (
                            <button
                              key={file.id}
                              onClick={() => downloadFile(file.id, file.original_file_name)}
                              className="inline-flex items-center gap-1 text-sky-600 hover:text-sky-800"
                            >
                              <i className="fa-solid fa-file" />
                              <span className="truncate max-w-[120px]">{file.original_file_name || `Файл ${index + 1}`}</span>
                            </button>
                          ))
                        ) : (
                          <span className="text-slate-400">
                            <i className="fa-solid fa-file-circle-xmark mr-1" />
                            Нет файла
                          </span>
                        )}
                      </div>

                      {doc.rejection_reason && (
                        <div className="mb-3 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700">
                          <i className="fa-solid fa-circle-exclamation mr-1" />
                          <span className="font-medium">Причина отклонения:</span> {doc.rejection_reason}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openModal('approve', doc)}
                          className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                        >
                          <i className="fa-solid fa-check mr-1.5" />
                          Одобрить
                        </button>
                        <button
                          type="button"
                          onClick={() => openModal('reject', doc)}
                          className="flex-1 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-700"
                        >
                          <i className="fa-solid fa-xmark mr-1.5" />
                          Отклонить
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
                  <p className="text-sm text-slate-500">
                    Нет заявок за период "{selectedSemesterLabel}" в группе "{currentGroupName}"
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab == `statistics` && (
            <div className="mt-5">
              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.10)] sm:p-5">
                <h2 className="mb-5 text-sm font-semibold text-slate-900 sm:text-base">
                  Аналитика: {currentGroupName}{' '}
                  <span className="text-xs font-normal text-slate-500 sm:text-sm">
                    ({selectedSemesterLabel})
                  </span>
                </h2>

                {/* Верхние карточки со статистикой */}
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

                {/* Нижний блок: распределение и топ-5 */}
                <div className="grid gap-5 grid-cols-[1.1fr,1.3fr] md:grid md:grid-cols-2">
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
                            <div key={label}>
                              <div className="mb-1 flex items-center justify-between text-[13px] text-slate-800">
                                <span>{label}</span>
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

      {/* Модалки */}
      {modalState.type == `approve` && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 px-4 py-6 sm:px-0"
          onClick={(e) => {
            if (e.target == e.currentTarget) closeModal();
          }}
        >
          <div className="relative w-full max-w-md rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.35)] sm:p-6">
            <button
              type="button"
              className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full text-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              onClick={closeModal}
            >
              &times;
            </button>
            <h2 className="mb-2.5 text-base font-semibold text-slate-900">
              Подтвердить достижение?
            </h2>
            <p className="text-sm text-slate-500">
              Студенту будет начислено{' '}
              <b className="font-semibold text-slate-900">
                {modalState.targetScore}
              </b>{' '}
              балл(-ов).
            </p>
            <div className="mt-5">
              <button
                type="button"
                className="inline-flex w-full items-center justify-center rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
                onClick={handleApprove}
              >
                Подтвердить
              </button>
            </div>
            <div className="mt-6 flex justify-center">
              <img
                src="/media/logo_BGITU.png"
                alt="БГИТУ"
                className="h-8 w-auto opacity-80"
              />
            </div>
          </div>
        </div>
      )}

      {modalState.type == `reject` && (
        <div
          id="modal-reject"
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 px-4 py-6 sm:px-0"
          onClick={(e) => {
            if (e.target == e.currentTarget) closeModal();
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.35)] sm:p-6">
            <h2 className="mb-3 text-base font-semibold text-slate-900">
              Укажите причину отказа
            </h2>
            <form className="space-y-3" onSubmit={handleReject}>
              <div className="space-y-2.5">
                {rejectionReasonsList.map((reason) => (
                  <label
                    key={reason.id}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 transition hover:border-sky-400 hover:bg-sky-50 sm:text-sm"
                  >
                    <span className="pr-2">{reason.text}</span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                      onChange={() => toggleReason(reason.id)}
                      checked={rejectReasons.includes(reason.id)}
                    />
                  </label>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="submit"
                  className="inline-flex flex-1 items-center justify-center rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-1"
                >
                  Отправить
                </button>
                <button
                  type="button"
                  className="inline-flex flex-1 items-center justify-center rounded-full bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1"
                  onClick={closeModal}
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}