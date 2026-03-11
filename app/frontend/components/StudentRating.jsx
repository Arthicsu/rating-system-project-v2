'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '@/lib/axios';

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
  const [activeTab, setActiveTab] = useState('common');
  const [students, setStudents] = useState([]);

  const [selectedFaculty, setSelectedFaculty] = useState('all');
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const scoreMap = {
    common: 'total_score',
    study: 'academic_score',
    social: 'social_score',
    sport: 'sport_score',
    science: 'research_score',
    culture: 'cultural_score',
  };

  useEffect(() => {
    api
      .get(`/user/api/v1/rating/`)
      .then((res) => setStudents(res.data))
      .catch((err) => console.error(err));
  }, []);

  const currentField = scoreMap[activeTab];

  const filteredByFaculty =
    selectedFaculty === 'all'
      ? students
      : students.filter((s) => s.faculty === selectedFaculty);

  const availableCourses = Array.from(
    new Set(
      filteredByFaculty
        .map((s) => s.course)
        .filter((v) => v !== null && v !== undefined),
    ),
  );

  const filteredByCourse =
    selectedCourse === 'all'
      ? filteredByFaculty
      : filteredByFaculty.filter((s) => String(s.course) === selectedCourse);

  const availableGroups = Array.from(
    new Set(filteredByCourse.map((s) => s.group).filter(Boolean)),
  );

  const filteredStudents =
    selectedGroup === 'all'
      ? filteredByCourse
      : filteredByCourse.filter((s) => s.group === selectedGroup);

  const faculties = Array.from(
    new Set(students.map((s) => s.faculty).filter(Boolean)),
  );

  const ratingData = [...filteredStudents]
    .sort((a, b) => (b[currentField] || 0) - (a[currentField] || 0))
    .map((student, index) => ({
      rank: index + 1,
      user_id: student.user_id,
      name: student.full_name,
      score: student[currentField],
      faculty: student.faculty,
      course: student.course,
      group: student.group,
    }));

  const tabs = [
    { id: 'common', label: 'Общий рейтинг' },
    { id: 'study', label: 'Учебная деятельность' },
    { id: 'social', label: 'Общественная деятельность' },
    { id: 'sport', label: 'Спортивная деятельность' },
    { id: 'science', label: 'Научно-исследовательская деятельность' },
    { id: 'culture', label: 'Культурно-творческая деятельность' },
  ];

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
              onChange={(e) => setActiveTab(e.target.value)}
            >
              {tabs.map((tab) => (
                <option key={tab.id} value={tab.id}>
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
                onClick={() => setActiveTab(tab.id)}
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
                      setSelectedFaculty(e.target.value);
                      setSelectedCourse('all');
                      setSelectedGroup('all');
                    }}
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] outline-none focus:border-sky-700 focus:ring-1 focus:ring-sky-700"
                  >
                    <option value="all">Все</option>
                    {faculties.map((faculty) => (
                      <option key={faculty} value={faculty}>
                        {faculty}
                      </option>
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
                      setSelectedCourse(e.target.value);
                      setSelectedGroup('all');
                    }}
                    disabled={availableCourses.length === 0}
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] outline-none focus:border-sky-700 focus:ring-1 focus:ring-sky-700 disabled:cursor-not-allowed disabled:bg-slate-100"
                  >
                    <option value="all">Все</option>
                    {availableCourses
                      .slice()
                      .sort((a, b) => a - b)
                      .map((course) => (
                        <option key={course} value={String(course)}>
                          {course}
                        </option>
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
                    onChange={(e) => setSelectedGroup(e.target.value)}
                    disabled={availableGroups.length === 0}
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] outline-none focus:border-sky-700 focus:ring-1 focus:ring-sky-700 disabled:cursor-not-allowed disabled:bg-slate-100"
                  >
                    <option value="all">Все</option>
                    {availableGroups
                      .slice()
                      .sort((a, b) => a.localeCompare(b))
                      .map((group) => (
                        <option key={group} value={group}>
                          {group}
                        </option>
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
                            setSelectedFaculty(e.target.value);
                            setSelectedCourse('all');
                            setSelectedGroup('all');
                          }}
                          size="1"
                          className="w-auto max-[411px]:hidden rounded-md border border-slate-300 bg-white px-1 sm:px-1.5 md:px-2 py-0.5 md:py-1 text-[9px] sm:text-[11px] md:text-xs lg:text-sm text-black outline-none focus:border-sky-700 focus:ring-1 focus:ring-sky-700"
                        >
                          <option value="all">Все</option>
                          {faculties.map((faculty) => (
                            <option key={faculty} value={faculty}>
                              {faculty}
                            </option>
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
                            setSelectedCourse(e.target.value);
                            setSelectedGroup('all');
                          }}
                          disabled={availableCourses.length === 0}
                          className=" max-[411px]:hidden w-auto rounded-md border border-slate-300 bg-white px-1 sm:px-1.5 md:px-2 py-0.5 md:py-1 text-[9px] sm:text-[11px] md:text-xs lg:text-sm text-black outline-none focus:border-sky-700 focus:ring-1 focus:ring-sky-700 disabled:cursor-not-allowed disabled:bg-slate-100"
                        >
                          <option value="all">Все</option>
                          {availableCourses
                            .slice()
                            .sort((a, b) => a - b)
                            .map((course) => (
                              <option key={course} value={String(course)}>
                                {course}
                              </option>
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
                          onChange={(e) => setSelectedGroup(e.target.value)}
                          disabled={availableGroups.length === 0}
                          className=" max-[411px]:hidden w-auto rounded-md border border-slate-300 bg-white px-1 sm:px-1.5 md:px-2 py-0.5 md:py-1 text-[9px] sm:text-[11px] md:text-xs lg:text-sm text-black outline-none focus:border-sky-700 focus:ring-1 focus:ring-sky-700 disabled:cursor-not-allowed disabled:bg-slate-100"
                        >
                          <option value="all">Все</option>
                          {availableGroups
                            .slice()
                            .sort((a, b) => a.localeCompare(b))
                            .map((group) => (
                              <option key={group} value={group}>
                                {group}
                              </option>
                            ))}
                        </select>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ratingData.map((student, index) => (
                    <tr
                      key={index}
                      className="border-b border-[#f0f0f0] text-xs sm:text-xs md:text-sm last:border-b-0 hover:bg-slate-50"
                    >
                      <td className="p-1 sm:p-2 md:px-4  md:py-3 text-center align-middle">
                        <div className="mx-auto flex h-4 w-4 sm:h-6 sm:w-6 md:h-8 md:w-8 items-center justify-center rounded-full bg-sky-700 text-[11px] md:text-sm font-bold text-white">
                          {student.rank}
                        </div>
                      </td>
                      <td className="p-1 sm:p-2 md:px-4 md:py-3 text-left text-xs md:text-sm text-[#333]">
                        <span className="inline md:hidden">
                          {getShortName(student.name)}
                        </span>
                        <span className="hidden md:inline">{student.name}</span>
                      </td>
                      <td className="p-1 sm:p-2 md:px-4 md:py-3 text-center text-xs md:text-sm font-bold text-sky-700">
                        {student.score}
                      </td>
                      <td className="p-1 sm:p-2 md:px-4 md:py-3 text-center text-xs md:text-sm">
                        {student.faculty}
                      </td>
                      <td className="p-1 sm:p-2 md:px-4 md:py-3 text-center text-xs md:text-sm">
                        {student.course}
                      </td>
                      <td className="p-1 sm:p-2 md:px-4 md:py-3 text-center text-xs md:text-sm">
                        {student.group}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}