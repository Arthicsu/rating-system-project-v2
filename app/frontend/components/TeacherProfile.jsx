`use client`;
import { useState, useMemo, useEffect } from 'react';
import api from '@/lib/axios';


export default function TeacherProfile({profile, isOwner}) {
  const [activeTab, setActiveTab] = useState(`my-group`);
  const [localProfile, setLocalProfile] = useState(profile);
  const [rejectReasons, setRejectReasons] = useState([]);

  const [modalState, setModalState] = useState({
    type: null,
    targetId: null,
    targetScore: 0,
    targetStudentId: null
  });

  const getInitialGroupId = () => {
    const managed = profile.managed_groups || [];
    const curated = profile.curated_groups || [];
    const groupsSource = managed.length > 0 ? managed : curated;
    return groupsSource.length > 0 ? String(groupsSource[0].id) : 'all';
  };

  const initialGroupId = getInitialGroupId();
  const [selectedGroupId, setSelectedGroupId] = useState(initialGroupId);
  const [searchTerm, setSearchTerm] = useState('');
  const [requestsSearchTerm, setRequestsSearchTerm] = useState('');
  
  const [rejectionReasonsList, setRejectionReasonsList] = useState([]);
  const [semesterOptions, setSemesterOptions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedSemester, setSelectedSemester] = useState('');

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
  
  const filteredStudents = useMemo(() => {
    let students = localProfile.students_list || [];
    if (selectedGroupId != 'all') {
      students = students.filter(s => String(s.group_id) == String(selectedGroupId));
    }
    if (searchTerm.trim() != '') {
      const lowerTerm = searchTerm.toLowerCase();
      students = students.filter(s => 
        s.full_name.toLowerCase().includes(lowerTerm) || 
        (s.record_book && s.record_book.toLowerCase().includes(lowerTerm))
      );
    }
    return students;
  }, [localProfile.students_list, selectedGroupId, searchTerm]);


  const filteredDocs = useMemo(() => {
    let docs = localProfile.pending_documents || [];
    if (selectedGroupId != 'all') {
      docs = docs.filter(d => String(d.group_id) == String(selectedGroupId));
    }
    const currentRange = semesterOptions.find(opt => opt.label == selectedSemester);
    if (currentRange && currentRange.start) {
        docs = docs.filter(d => {
            const docDate = new Date(d.uploaded_at); 
            return docDate >= currentRange.start && docDate <= currentRange.end;
        });
    }
    if (requestsSearchTerm.trim() != '') {
      const lowerTerm = requestsSearchTerm.toLowerCase();
      docs = docs.filter(d =>
        d.student_name.toLowerCase().includes(lowerTerm)
      );
    }
    return docs;
  }, [localProfile.pending_documents, selectedGroupId, selectedSemester, requestsSearchTerm]);

  const dynamicStats = useMemo(() => {
    const students = filteredStudents;
    const defaults = {
      total_students: 0,
      avg_score: 0,
      max_score: 0,
      min_score: 0,
      active_requests: 0,
      top5: [],
      categories: {}
    };

    if (students.length == 0) return {...defaults, active_requests: filteredDocs.length};

    const scores = students.map(s => s.total_score);
    
    const catStats = {};
    categories.forEach(cat => {
      const fieldName = `${cat.code}_score`;
      catStats[cat.label] = students.reduce((acc, s) => acc + (s[fieldName] || 0), 0);
    });

    return {
      total_students: students.length,
      avg_score: Math.round(scores.reduce((a, b) => a + b, 0) / students.length),
      max_score: Math.max(...scores),
      min_score: Math.min(...scores),
      active_requests: filteredDocs.length,
      top5: [...students].sort((a, b) => b.total_score - a.total_score).slice(0, 5),
      categories: catStats
    };
  }, [filteredStudents, filteredDocs, categories]);

  const handleApprove = async () => {
    if (!modalState.targetId) return;

    try {
      console.log(modalState.targetId)
      await api.post(`/university/api/v1/document/${modalState.targetId}/review/`, {
        action: 'approve'
      });

      setLocalProfile(prev => {
          const newPending = prev.pending_documents.filter(doc => doc.id != modalState.targetId);
          
          const newStudentsList = prev.students_list.map(student => {
              if (student.id == modalState.targetStudentId) {
                  return {
                      ...student,
                      total_score: student.total_score + modalState.targetScore
                  };
              }
              return student;
          });

          return {
              ...prev,
              pending_documents: newPending,
              students_list: newStudentsList
          };
      });

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

    try {
      console.log(modalState.targetId)
      await api.post(`/university/api/v1/document/${modalState.targetId}/review/`, {
        action: 'reject',
        reasons: rejectReasons
      });

      setLocalProfile(prev => ({
        ...prev,
        pending_documents: prev.pending_documents.filter(doc => doc.id !== modalState.targetId)
      }));

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

  const curatedGroups = profile.curated_groups && profile.curated_groups.length > 0 ? profile.curated_groups.map(g => g.name).join(', ') : "Нет курируемых групп";
  const groupsList = (localProfile.managed_groups && localProfile.managed_groups.length > 0)
    ? localProfile.managed_groups
    : (profile.curated_groups || []);
  const currentGroupName =
    selectedGroupId === 'all'
      ? 'Все группы'
      : (groupsList.find(g => String(g.id) === String(selectedGroupId))?.name || 'Все группы');

  useEffect(() => {
    const fetchLookups = async () => {
      try {
        const [reasonsRes, semestersRes, catsRes] = await Promise.all([
          api.get('/university/api/v1/rejection-reasons/'),
          api.get('/university/api/v1/academic-years/'),
          api.get('/user/api/v1/category-achievements/')
        ]);
        
        setRejectionReasonsList(reasonsRes.data);
        setSemesterOptions(semestersRes.data);
        setCategories(catsRes.data);

        const current = semestersRes.data.find(s => s.is_current);
        if (current) setSelectedSemester(current.label);
      } catch (error) {
        alert("Ошибка: " + error);
      }
    };
    fetchLookups();
  }, []);

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
                  onChange={(e) => setSelectedGroupId(e.target.value)}
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
                  value={selectedSemester}
                  onChange={(e) => setSelectedSemester(e.target.value)}
                >
                  {semesterOptions.map((opt) => (
                    <option key={opt.label} value={opt.label}>
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
                      (студентов: {filteredStudents.length})
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
              </div>
            </div>
          )}

          {activeTab == `pending-requests` && (
            <div className="mt-5">
              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.10)] sm:p-5">
                <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-sm font-semibold text-slate-900 sm:text-base">
                    Заявки: {selectedSemester},{' '}
                    <span className="font-semibold text-slate-900">
                      {currentGroupName}
                    </span>
                  </h2>
                </div>
                <div className="mb-4 flex items-center gap-3">
                  <div className="relative flex items-center">
                    <i className="fa-solid fa-magnifying-glass pointer-events-none absolute left-3 text-[11px] text-slate-400" />
                    <input
                      type="text"
                      className="w-55 rounded-full border border-slate-200 bg-white py-1.5 pl-7 pr-3 text-xs text-slate-900 placeholder:text-slate-400 outline-none ring-sky-500/0 transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/70 sm:text-sm"
                      placeholder="Поиск по ФИО"
                      value={requestsSearchTerm}
                      onChange={(e) => setRequestsSearchTerm(e.target.value)}
                    />
                  </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
                  <table className="min-w-full text-left text-[11px] text-slate-500 sm:text-xs md:text-sm">
                    <thead className="bg-slate-500 text-[10px] font-semibold uppercase tracking-wide text-slate-100 sm:text-[11px]">
                      <tr>
                        <th className="px-3 py-2.5">ФИО студента</th>
                        <th className="px-3 py-2.5">Категория</th>
                        <th className="px-3 py-2.5">Достижение / Уровень</th>
                        <th className="px-3 py-2.5">Результат / Место</th>
                        <th className="px-3 py-2.5">Описание</th>
                        <th className="px-3 py-2.5">Документ / Дата</th>
                        <th className="px-3 py-2.5">Баллы</th>
                        <th className="px-3 py-2.5 text-right">Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDocs.length > 0 ? (
                        filteredDocs.map((doc) => (
                          <tr
                            key={doc.id}
                            className="border-t border-slate-100 align-top hover:bg-slate-50/70"
                          >
                            <td className="px-3 py-2.5">
                              <div className="text-xs font-medium text-slate-900 sm:text-sm">
                                {doc.student_name}
                              </div>
                              <div className="mt-0.5 text-[11px] text-slate-500">
                                {doc.record_book}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-xs text-slate-800 sm:text-sm">
                              {doc.category_display}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-slate-800 sm:text-sm">
                              {doc.sub_type_display} / {doc.level_display}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-slate-800 sm:text-sm">
                              {doc.result_display}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-slate-800 sm:text-sm max-w-80 align-top">
                              <div className="max-h-14 overflow-y-auto wrap-break-word whitespace-normal pr-1">
                                {doc.achievement}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-xs text-slate-800 sm:text-sm">
                              {doc.file ? (
                                <a
                                  href={doc.file}
                                  target="_blank"
                                  className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-700 hover:text-sky-900 sm:text-xs"
                                >
                                  <i className="fa-solid fa-file" />
                                  Документ
                                </a>
                              ) : (
                                <span className="text-[11px] text-slate-400 sm:text-xs">
                                  Нет файла
                                </span>
                              )}
                              <div className="mt-1 text-[10px] text-slate-400">
                                {new Date(doc.uploaded_at).toLocaleDateString(
                                  'ru-RU'
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-xs font-semibold text-emerald-600 sm:text-sm">
                              +{doc.score}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <div className="flex flex-wrap justify-end gap-2">
                                <button
                                  type="button"
                                  className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-1"
                                  onClick={() => openModal('approve', doc)}
                                  title="Одобрить"
                                >
                                  Одобрить
                                </button>
                                <button
                                  type="button"
                                  className="inline-flex items-center justify-center rounded-lg bg-rose-700 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-rose-800 focus:outline-none focus:ring-2 focus:ring-rose-700 focus:ring-offset-1"
                                  onClick={() => openModal('reject', doc)}
                                  title="Отклонить"
                                >
                                  Отклонить
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={8}
                            className="px-4 py-6 text-center text-xs text-slate-500 sm:text-sm"
                          >
                            Нет заявок за период "{selectedSemester}" в группе "
                            {currentGroupName}"
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab == `statistics` && (
            <div className="mt-5">
              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.10)] sm:p-5">
                <h2 className="mb-5 text-sm font-semibold text-slate-900 sm:text-base">
                  Аналитика: {currentGroupName}{' '}
                  <span className="text-xs font-normal text-slate-500 sm:text-sm">
                    ({selectedSemester})
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
                      Распределение баллов
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