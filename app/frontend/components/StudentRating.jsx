'use client';
import { useState, useEffect, useMemo } from 'react';
import api from '@/lib/axios';
import { useMySession } from '@/context/AuthContext';

function getShortName(fullName = '') {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return fullName;
  const [lastName, ...rest] = parts;
  const initials = rest
    .filter(Boolean)
    .map((p) => (p[0] || '').toUpperCase() + '.')
    .join('');
  return `${lastName} ${initials}`;
}

export default function StudentRating() {
  const { user } = useMySession();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [filterOptions, setFilterOptions] = useState({ faculties: [], courses: [], groups: [] });
  
  const [selectedFaculty, setSelectedFaculty] = useState('all');
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [activeTab, setActiveTab] = useState('common');
  const [tabs, setTabs] = useState([{ id: 'common', label: 'Общий рейтинг' }]);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 20; // Количество записей на страницу

  // Загрузка категорий
  useEffect(() => {
    api.get('/user/api/v1/category-achievements/')
      .then(res => {
        const dynamicTabs = res.data.map(cat => ({
          id: cat.code,
          label: cat.label.endsWith('рейтинг') ? cat.label : `${cat.label} деятельность`
        }));
        setTabs([{ id: 'common', label: 'Общий рейтинг' }, ...dynamicTabs]);
      })
      .catch(error => alert('Ошибка: ', error));
  }, []);

  // Загрузка опций для фильтров
  useEffect(() => {
    api.get('/user/api/v1/rating-filters/')
      .then(res => setFilterOptions(res.data))
      .catch(error => console.error('Ошибка: ', error));
  }, []);

  useEffect(() => {
    const fetchRating = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedFaculty !== 'all') params.append('faculty', selectedFaculty);
        if (selectedCourse !== 'all') params.append('course', selectedCourse);
        if (selectedGroup !== 'all') params.append('group', selectedGroup);
        
        params.append('category', activeTab);
        params.append('page', String(page));

        const response = await api.get(`/user/api/v2/rating/`, { params });
        
        setStudents(response.data.results);
        setTotalCount(response.data.count);
      } catch (error) {
        console.error('Ошибка: ', error);
      } finally {
        setLoading(false);
      }
    };
    fetchRating();
  }, [activeTab, selectedFaculty, selectedCourse, selectedGroup, page]);

  // Доступные группы на основе выбранного факультета и курса
  const availableGroups = useMemo(() => {
    return filterOptions.groups.filter(g => {
      const matchFaculty = selectedFaculty === 'all' || g.faculty_short_name === selectedFaculty;
      const matchCourse = selectedCourse === 'all' || String(g.course) === selectedCourse;
      return matchFaculty && matchCourse;
    });
  }, [filterOptions.groups, selectedFaculty, selectedCourse]);
  
  const scoreKey = activeTab == 'common' ? 'total_score' : `${activeTab}_score`;
  const handleTabChange = (id) => {
    setActiveTab(id);
    setPage(1); // Всегда возвращаемся на первую страницу
  };

  const handleFilterChange = (setter, value) => {
    setter(value);
    setPage(1);
  };

 const handleExportToExcel = async () => {
    setExportLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedFaculty !== 'all') params.append('faculty', selectedFaculty);
      if (selectedCourse !== 'all') params.append('course', selectedCourse);
      if (activeTab !== 'common') params.append('category', activeTab);
      params.append('page', String(page));
      const response = await api.get('/university/api/v1/export-rating-to-excel/', {
        params,
        responseType: 'blob'
      });
      const disposition = response.headers['content-disposition'];
      const fileNameFromHeader = disposition?.match(/filename="?([^"]+)"?/)?.[1];
      const fileName = fileNameFromHeader || `rating-page-${page}.xlsx`;
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Ошибка при выгрузке Excel:', error);
      alert('Не удалось выгрузить Excel файл');
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="pt-25">
      {/* Фильтры баллов */}
      <div className="mb-5 w-full bg-transparent">
        <div className="mx-auto max-w-350 px-5">
          {/* Мобильный вариант — выпадающий список */}
          <div className="block sm:hidden">
            <select
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-xs text-[#333] shadow-[0_2px_10px_rgba(0,0,0,0.05)] focus:border-sky-700 focus:ring-1 focus:ring-sky-700"
              value={activeTab}
              onChange={(e) => handleTabChange(e.target.value)}
            >
              {tabs.map((tab) => (
                <option key={tab.id} onClick={() => handleTabChange(tab.id)} value={tab.id}>
                  {tab.label}
                </option>
              ))}
            </select>
          </div>

          {/* Десктопный вариант — кнопки-вкладки */}
          <div className="hidden sm:inline-flex overflow-hidden rounded-lg bg-white shadow-[0_2px_10px_rgba(0,0,0,0.05)] text-[11px] sm:text-xs md:text-sm lg:text-base">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`border-r border-[#f0f0f0] px-1.5 sm:px-2 md:px-3 lg:px-4 py-1 sm:py-1.5 md:py-2 lg:py-3 transition-colors last:border-r-0 ${
                  activeTab === tab.id
                    ? 'bg-sky-700 text-white'
                    : 'bg-transparent text-[#333] hover:bg-[#e9ecef]'
                }`}
                onClick={() => handleTabChange(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Таблица и фильтры */}
      <section className="w-full pb-6">
        <div className="mx-auto max-w-350 px-5">
          {/* Кнопка для мобильных фильтров (≤ 411px) */}
          <div className="mb-2 hidden max-[411px]:flex items-center">
            <button
              type="button"
              aria-label="Фильтры"
              onClick={() => setMobileFiltersOpen((prev) => !prev)}
              className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-700 shadow-sm active:scale-95 transition"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>

          {/* Выпадающая панель фильтров для мобильных (≤ 411px) */}
          {mobileFiltersOpen && (
            <div className="mb-3 max-[411px]:block hidden rounded-lg bg-white p-3 shadow-[0_2px_10px_rgba(0,0,0,0.08)] text-[11px] text-slate-700">
              <div className="mb-2 font-semibold">Фильтры</div>
              <div className="space-y-2">
                <div className="flex flex-col gap-1">
                  <label htmlFor="m-faculty" className="text-[10px] uppercase tracking-wide text-slate-500">
                    Факультет
                  </label>
                  <select
                    id="m-faculty"
                    value={selectedFaculty}
                    onChange={(e) => {
                      handleFilterChange(setSelectedFaculty, e.target.value);
                      handleFilterChange(setSelectedCourse, 'all');
                      handleFilterChange(setSelectedGroup, 'all');
                    }}
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] outline-none focus:border-sky-700 focus:ring-1 focus:ring-sky-700"
                  >
                    <option value="all">Все</option>
                    {filterOptions.faculties.map(f => (
                      <option key={f.id} value={f.short_name}>{f.short_name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="m-course" className="text-[10px] uppercase tracking-wide text-slate-500">
                    Курс
                  </label>
                  <select
                    id="m-course"
                    value={selectedCourse}
                    onChange={(e) => {
                      handleFilterChange(setSelectedCourse, e.target.value);
                      handleFilterChange(setSelectedGroup, 'all');
                    }}
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] outline-none focus:border-sky-700 focus:ring-1 focus:ring-sky-700 disabled:cursor-not-allowed disabled:bg-slate-100"
                  >
                    <option value="all">Все</option>
                    {[1, 2, 3, 4, 5].map(c => (
                      <option key={c} value={String(c)}>{c} курс</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="m-group" className="text-[10px] uppercase tracking-wide text-slate-500">
                    Группа
                  </label>
                  <select
                    id="m-group"
                    value={selectedGroup}
                    onChange={(e) => handleFilterChange(setSelectedGroup, e.target.value)}
                    disabled={availableGroups.length === 0}
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] outline-none focus:border-sky-700 focus:ring-1 focus:ring-sky-700 disabled:cursor-not-allowed disabled:bg-slate-100"
                  >
                    <option value="all">Все</option>
                    {availableGroups.map(g => (
                      <option key={g.id} value={g.id}>{g.name} ({g.academic_year})</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-lg bg-white p-2 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
            <div className="w-full overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="bg-slate-500 text-white">
                    <th className="w-14 px-1.5 sm:px-2 md:px-3 lg:px-4 py-1.5 sm:py-2 md:py-2.5 lg:py-3 text-left text-[11px] sm:text-xs md:text-sm lg:text-base font-normal rounded-l-lg">
                    </th>
                    <th className="px-1.5 sm:px-2 md:px-3 lg:px-4 py-1.5 sm:py-2 md:py-2.5 lg:py-3 text-left text-[11px] sm:text-xs md:text-sm lg:text-base font-normal">
                      ФИО Студента
                    </th>
                    <th className="px-1.5 sm:px-2 md:px-3 lg:px-4 py-1.5 sm:py-2 md:py-2.5 lg:py-3 text-center text-[11px] sm:text-xs md:text-sm lg:text-base font-normal">
                      Баллы
                    </th>

                    {/* Факультет */}
                    <th className=" px-1.5 sm:px-2 md:px-3 lg:px-4 py-1.5 sm:py-2 md:py-2.5 lg:py-3 text-[11px] sm:text-xs md:text-sm lg:text-base font-normal ">
                      <div className="flex max-[544px]:flex-col items-center justify-center gap-1.5 sm:gap-2 text-center text-[9px] sm:text-[11px] md:text-xs lg:text-sm text-white">
                        <label htmlFor="faculty-select" className="font-medium">
                          Факультет
                        </label>
                        <select
                          id="faculty-select"
                          value={selectedFaculty}
                          onChange={(e) => {
                            handleFilterChange(setSelectedFaculty, e.target.value);
                            handleFilterChange(setSelectedCourse, 'all');
                            handleFilterChange(setSelectedGroup, 'all');
                          }}
                          className="w-auto max-[411px]:hidden rounded-md border border-slate-300 bg-white px-1 sm:px-1.5 md:px-2 py-0.5 md:py-1 text-[9px] sm:text-[11px] md:text-xs lg:text-sm text-black outline-none focus:border-sky-700 focus:ring-1 focus:ring-sky-700"
                        >
                          <option value="all">Все</option>
                          {filterOptions.faculties.map(f => (
                            <option key={f.id} value={f.short_name}>{f.short_name}</option>
                          ))}
                        </select>
                      </div>
                    </th>

                    {/* Курс */}
                    <th className=" px-1.5 sm:px-2 md:px-3 lg:px-4 py-1.5 sm:py-2 md:py-2.5 lg:py-3 text-[11px] sm:text-xs md:text-sm lg:text-base font-normal">
                      <div className="flex max-[544px]:flex-col items-center justify-center gap-1.5 sm:gap-2 text-center text-[9px] sm:text-[11px] md:text-xs lg:text-sm text-white">
                        <label htmlFor="course-select" className="font-medium">
                          Курс
                        </label>
                        <select
                          id="course-select"
                          value={selectedCourse}
                          onChange={(e) => {
                            handleFilterChange(setSelectedCourse, e.target.value);
                            handleFilterChange(setSelectedGroup, 'all');
                          }}
                          className=" max-[411px]:hidden w-auto rounded-md border border-slate-300 bg-white px-1 sm:px-1.5 md:px-2 py-0.5 md:py-1 text-[9px] sm:text-[11px] md:text-xs lg:text-sm text-black outline-none focus:border-sky-700 focus:ring-1 focus:ring-sky-700 disabled:cursor-not-allowed disabled:bg-slate-100"
                        >
                          <option value="all">Все</option>
                          {[1, 2, 3, 4, 5].map(c => (
                            <option key={c} value={String(c)}>{c} курс</option>
                          ))}
                        </select>
                      </div>
                    </th>

                    {/* Группа */}
                    <th className=" px-1.5 sm:px-2 md:px-3 lg:px-4 py-1.5 sm:py-2 md:py-2.5 lg:py-3 text-[11px] sm:text-xs md:text-sm lg:text-base font-normal rounded-r-lg">
                      <div className="flex max-[544px]:flex-col items-center justify-center gap-1.5 sm:gap-2 text-center text-[9px] sm:text-[11px] md:text-xs lg:text-sm text-white">
                        <label htmlFor="group-select" className="font-medium">
                          Группа
                        </label>
                        <select
                          id="group-select"
                          value={selectedGroup}
                          onChange={(e) => handleFilterChange(setSelectedGroup, e.target.value)}
                          disabled={availableGroups.length === 0}
                          className=" max-[411px]:hidden w-auto rounded-md border border-slate-300 bg-white px-1 sm:px-1.5 md:px-2 py-0.5 md:py-1 text-[9px] sm:text-[11px] md:text-xs lg:text-sm text-black outline-none focus:border-sky-700 focus:ring-1 focus:ring-sky-700 disabled:cursor-not-allowed disabled:bg-slate-100"
                        >
                          <option value="all">Все</option>
                          {availableGroups.map(g => (
                            <option key={g.id} value={g.id}>{g.name} ({g.academic_year})</option>
                          ))}
                        </select>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className={loading ? 'opacity-50 transition-opacity' : ''}>
                  {students.map((student, index) => (
                    <tr key={student.user_id} className="border-b border-[#f0f0f0] text-xs sm:text-xs md:text-sm last:border-b-0 hover:bg-slate-50">
                      <td className="p-1 sm:p-2 md:px-4  md:py-3 text-center align-middle">
                        <div className="mx-auto flex h-4 w-4 sm:h-6 sm:w-6 md:h-8 md:w-8 items-center justify-center rounded-full bg-sky-700 text-[11px] md:text-sm font-bold text-white">
                          {(page - 1) * PAGE_SIZE + index + 1}
                        </div>
                      </td>
                      <td className="p-1 sm:p-2 md:px-4 md:py-3 text-left text-xs md:text-sm text-[#333]">
                        <span className="inline md:hidden">
                          {getShortName(student.full_name)}
                        </span>
                        <span className="hidden md:inline">{student.full_name}</span>
                      </td>
                      <td className="p-1 sm:p-2 md:px-4 md:py-3 text-center text-xs md:text-sm font-bold text-sky-700">
                        {student[scoreKey]}
                      </td>
                      <td className="p-1 sm:p-2 md:px-4 md:py-3 text-center text-xs md:text-sm">{student.faculty}</td>
                      <td className="p-1 sm:p-2 md:px-4 md:py-3 text-center text-xs md:text-sm">{student.course}</td>
                      <td className="p-1 sm:p-2 md:px-4 md:py-3 text-center text-xs md:text-sm">{student.group}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {/* Блок пагинации */}
              <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4 px-2">
                <div className="text-xs text-slate-500">
                  Показано {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} из {totalCount}
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                    disabled={page === 1 || loading}
                    className="flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>

                  <div className="flex h-8 items-center px-3 text-sm font-medium text-slate-700">
                    {page}
                  </div>

                  <button
                    onClick={() => setPage(prev => prev + 1)}
                    disabled={page * PAGE_SIZE >= totalCount || loading}
                    className="flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
              {user?.isStaff && (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[11px] sm:text-xs text-slate-600">
                    В выгрузке можно выбирать разные факультеты, курсы и группы. Если выбрать вид
                    деятельности, итоговая сумма будет рассчитана именно по выбранной
                    деятельности.
                  </p>
                  <button
                    type="button"
                    onClick={handleExportToExcel}
                    disabled={exportLoading || loading}
                    className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-1.5 text-xs sm:text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {exportLoading ? 'Выгрузка...' : 'Выгрузить в Excel'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}