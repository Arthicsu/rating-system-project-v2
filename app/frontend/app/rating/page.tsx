'use client';
import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import Pagination from '@/components/Pagination';
import CustomSelect from '@/components/CustomSelect';
import { userApi } from '@/lib/apiRequests';
import type { FilterOptions, Tab, RatingParams } from '@/interfaces/RatingInterfaces';
import type Student from '@/interfaces/StudentInterfaces';

export default function RatingPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ faculties: [], courses: [], groups: [] });
  
  const [selectedFaculty, setSelectedFaculty] = useState('all');
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [activeTab, setActiveTab] = useState('common');
  const [tabs, setTabs] = useState<Tab[]>([{ id: 'common', label: 'Общий рейтинг' }]);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await userApi.getCategoryAchievements();
        const dynamicTabs = res.data.map((cat: { code: string; label: string }) => ({
          id: cat.code,
          label: cat.label.endsWith('рейтинг') ? cat.label : `${cat.label} деятельность`
        }));
        setTabs([{ id: 'common', label: 'Общий рейтинг' }, ...dynamicTabs]);
      } catch (error) {
        toast.error('Ошибка: ' + error);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const res = await userApi.getRatingFilters();
        setFilterOptions(res.data);
      } catch (error) {
        console.error('Ошибка: ', error);
      }
    };
    fetchFilters();
  }, []);

  useEffect(() => {
    const fetchRating = async () => {
      setLoading(true);
      setStudents([]);
      try {
        const params: RatingParams = {
          category: activeTab,
          page: currentPage,
          page_size: pageSize,
        };
        
        if (selectedFaculty !== 'all') params.faculty_id = selectedFaculty;
        if (selectedCourse !== 'all') params.course = selectedCourse;
        if (selectedGroup !== 'all') params.group_id = selectedGroup;

        const response = await userApi.getRating(params);
        
        setStudents(response.data.results);
        setTotalCount(response.data.count);
      } catch (error) {
        console.error('Ошибка: ', error);
        setStudents([]);
        setTotalCount(0);
      } finally {
        setLoading(false);
      }
    };
    fetchRating();
  }, [activeTab, selectedFaculty, selectedCourse, selectedGroup, currentPage]);

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

  return (
    <div className="pt-25">
      <div className="mb-5 w-full bg-transparent">
        <div className="mx-auto max-w-350 px-5">
          <div className="block sm:hidden">
            <CustomSelect
              id="tab-select"
              label="Фильтры рейтинга"
              value={activeTab}
              labelClassName="block text-[11px] font-medium text-slate-500"
              triggerClassName="text-xs"
              options={tabs.map((tab) => ({ value: tab.id, label: tab.label }))}
              onChange={handleTabChange}
            />
          </div>

          <div className="hidden sm:inline-flex overflow-hidden rounded-lg bg-white shadow-[0_2px_10px_rgba(0,0,0,0.05)] text-[11px] sm:text-xs md:text-sm lg:text-base">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`cursor-pointer border-r border-[#f0f0f0] px-1.5 sm:px-2 md:px-3 lg:px-4 py-1 sm:py-1.5 md:py-2 lg:py-3 transition-colors last:border-r-0 ${
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

      <section className="w-full pb-6">
        <div className="mx-auto max-w-350 px-5">
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

          {mobileFiltersOpen && (
            <div className="mb-3 max-[411px]:block hidden rounded-lg bg-white p-3 shadow-[0_2px_10px_rgba(0,0,0,0.08)] text-[11px] text-slate-700">
              <div className="mb-2 font-semibold">Фильтры</div>
              <div className="space-y-2">
                <CustomSelect
                  id="m-faculty"
                  label="Факультет"
                  value={selectedFaculty}
                  labelClassName="text-[10px] uppercase tracking-wide text-slate-500"
                  triggerClassName="text-[11px] py-1 px-2"
                  options={[
                    { value: 'all', label: 'Все' },
                    ...filterOptions.faculties.map((f) => ({ value: f.id, label: f.short_name })),
                  ]}
                  onChange={(value) => {
                    handleFilterChange(setSelectedFaculty, value);
                    handleFilterChange(setSelectedCourse, 'all');
                    handleFilterChange(setSelectedGroup, 'all');
                  }}
                />

                <CustomSelect
                  id="m-course"
                  label="Курс"
                  value={selectedCourse}
                  labelClassName="text-[10px] uppercase tracking-wide text-slate-500"
                  triggerClassName="text-[11px] py-1 px-2"
                  options={[
                    { value: 'all', label: 'Все' },
                    ...[1, 2, 3, 4, 5].map((c) => ({ value: String(c), label: `${c} курс` })),
                  ]}
                  onChange={(value) => {
                    handleFilterChange(setSelectedCourse, value);
                    handleFilterChange(setSelectedGroup, 'all');
                  }}
                />

                <CustomSelect
                  id="m-group"
                  label="Группа"
                  value={selectedGroup}
                  disabled={availableGroups.length === 0}
                  labelClassName="text-[10px] uppercase tracking-wide text-slate-500"
                  triggerClassName="text-[11px] py-1 px-2"
                  options={[
                    { value: 'all', label: 'Все' },
                    ...availableGroups.map((g) => ({ value: g.id, label: g.name })),
                  ]}
                  onChange={(value) => handleFilterChange(setSelectedGroup, value)}
                />
              </div>
            </div>
          )}

          <div className="rounded-lg bg-white p-2 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
            <div className="w-full overflow-x-auto">
              <table className="min-w-full border-collapse" style={{ tableLayout: 'fixed' }}>
                <thead>
                  <tr className="bg-sky-700 text-white">
                    <th className="w-10 sm:w-14 px-1.5 sm:px-2 md:px-3 lg:px-4 py-1.5 sm:py-2 md:py-2.5 lg:py-3 text-left text-[11px] sm:text-xs md:text-sm lg:text-base font-normal rounded-l-lg">
                    </th>
                    <th className="w-[35%] sm:w-auto px-1.5 sm:px-2 md:px-3 lg:px-4 py-1.5 sm:py-2 md:py-2.5 lg:py-3 text-left text-[11px] sm:text-xs md:text-sm lg:text-xl font-normal">
                      ФИО Студента
                    </th>
                    <th className=" w-16 sm:w-auto px-1.5 sm:px-2 md:px-3 lg:px-4 py-1.5 sm:py-2 md:py-2.5 lg:py-3 text-center text-[11px] sm:text-xs md:text-sm lg:text-xl font-normal">
                      Баллы
                    </th>

                    <th className="w-[20%] sm:w-auto px-1.5 sm:px-2 md:px-3 lg:px-4 py-1.5 sm:py-2 md:py-2.5 lg:py-3 text-[11px] sm:text-xs md:text-sm lg:text-base font-normal ">
                      <CustomSelect
                        id="faculty-select"
                        inline
                        label="Факультет"
                        value={selectedFaculty}
                        labelClassName="font-medium text-[9px] sm:text-[11px] md:text-xs lg:text-sm text-white"
                        triggerClassName="max-[411px]:hidden w-auto text-[9px] sm:text-[11px] md:text-xs lg:text-sm py-0.5 md:py-1 px-1 sm:px-1.5 md:px-2"
                        className="max-[544px]:flex-col"
                        options={[
                          { value: 'all', label: 'Все' },
                          ...filterOptions.faculties.map((f) => ({ value: f.id, label: f.short_name })),
                        ]}
                        onChange={(value) => {
                          handleFilterChange(setSelectedFaculty, value);
                          handleFilterChange(setSelectedCourse, 'all');
                          handleFilterChange(setSelectedGroup, 'all');
                        }}
                      />
                    </th>

                    <th className="w-[15%] sm:w-auto px-1.5 sm:px-2 md:px-3 lg:px-4 py-1.5 sm:py-2 md:py-2.5 lg:py-3 text-[11px] sm:text-xs md:text-sm lg:text-base font-normal">
                      <CustomSelect
                        id="course-select"
                        inline
                        label="Курс"
                        value={selectedCourse}
                        labelClassName="font-medium text-[9px] sm:text-[11px] md:text-xs lg:text-sm text-white"
                        triggerClassName="max-[411px]:hidden w-auto text-[9px] sm:text-[11px] md:text-xs lg:text-sm py-0.5 md:py-1 px-1 sm:px-1.5 md:px-2"
                        className="max-[544px]:flex-col"
                        options={[
                          { value: 'all', label: 'Все' },
                          ...[1, 2, 3, 4, 5].map((c) => ({ value: String(c), label: `${c} курс` })),
                        ]}
                        onChange={(value) => {
                          handleFilterChange(setSelectedCourse, value);
                          handleFilterChange(setSelectedGroup, 'all');
                        }}
                      />
                    </th>

                    <th className="w-[20%] sm:w-auto px-1.5 sm:px-2 md:px-3 lg:px-4 py-1.5 sm:py-2 md:py-2.5 lg:py-3 text-[11px] sm:text-xs md:text-sm lg:text-base font-normal rounded-r-lg">
                      <CustomSelect
                        id="group-select"
                        inline
                        label="Группа"
                        value={selectedGroup}
                        disabled={availableGroups.length === 0}
                        labelClassName="font-medium text-[9px] sm:text-[11px] md:text-xs lg:text-sm text-white"
                        triggerClassName="max-[411px]:hidden w-auto text-[9px] sm:text-[11px] md:text-xs lg:text-sm py-0.5 md:py-1 px-1 sm:px-1.5 md:px-2"
                        className="max-[544px]:flex-col"
                        options={[
                          { value: 'all', label: 'Все' },
                          ...availableGroups.map((g) => ({ value: g.id, label: g.name })),
                        ]}
                        onChange={(value) => handleFilterChange(setSelectedGroup, value)}
                      />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {!loading && students.length > 0 ? (
                    students.map((student, index) => (
                      <tr key={student.user_id} className="border-b border-[#0068a825] text-xs sm:text-xs md:text-sm last:border-b-0 hover:bg-slate-50 divide-x divide-[#0069a825]">
                        <td className="p-1 sm:p-2 md:px-4  md:py-3 text-center align-middle">
                          <div className="mx-auto flex h-4 w-4 sm:h-6 sm:w-6 md:h-8 md:w-8 items-center justify-center rounded-full bg-sky-700 text-[11px] md:text-sm font-bold text-white">
                            {(currentPage - 1) * pageSize + index + 1}
                          </div>
                        </td>
                        <td className="p-1 sm:p-2 md:px-4 md:py-3 text-left text-xs md:text-sm text-[#333] overflow-hidden">
                          <span className="inline md:hidden block truncate">
                            {student.short_name}
                          </span>
                          <span className="hidden md:inline truncate">{student.full_name}</span>
                        </td>
                        <td className="p-1 sm:p-2 md:px-4 md:py-3 text-center text-xs md:text-sm font-bold text-sky-700">
                          {Number(student[scoreKey])}
                        </td>
                        <td className="p-1 sm:p-2 md:px-4 md:py-3 text-center text-xs md:text-sm">{student.faculty}</td>
                        <td className="p-1 sm:p-2 md:px-4 md:py-3 text-center text-xs md:text-sm">{student.course}</td>
                        <td className="p-1 sm:p-2 md:px-4 md:py-3 text-center text-xs md:text-sm">{student.group}</td>
                      </tr>
                    ))
                  ) : !loading ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="p-4 text-center text-xs md:text-sm text-slate-500"
                      >
                        Студенты не найдены
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
              
              <Pagination 
                page={currentPage}
                totalCount={totalCount}
                pageSize={pageSize}
                loading={loading}
                onPageChange={setCurrentPage}
              />
              {/* <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] sm:text-xs text-slate-600">
                  Таблица рейтинга обновляется каждые 5 минут
                </p>
              </div>
              </Skeleton>
              {user?.is_staff && (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[11px] sm:text-xs text-slate-600">
                    В выгрузке можно выбирать разные факультеты, курсы и группы. Если выбрать вид
                    деятельности, итоговая сумма будет рассчитана именно по выбранной
                    деятельности.
                  </p>
                  <ExportExcelButton
                    filters={{
                      faculty_id: selectedFaculty,
                      course: selectedCourse,
                      group_id: selectedGroup
                    }}
                    category={activeTab}
                    page={page}
                  />
                </div>
              )} */}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}