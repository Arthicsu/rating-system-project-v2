'use client';

import Link from 'next/link';

import SearchInput from '@/components/SearchInput';
import ExportExcelButton from '@/components/ExportExcelButton';
import Pagination from '@/components/Pagination';
import RatingTabs from './RatingTabs';
import type { ExportExcelParams, Tab } from '@/interfaces/RatingInterfaces';
import type Student from '@/interfaces/StudentInterfaces';

interface StudentsTabProps {
  students: Student[];
  loading: boolean;
  totalStudents: number;
  currentPage: number;
  pageSize: number;
  isRectorate: boolean;
  selectedGroupId: string;
  currentGroupName: string;
  /** Подвкладки категорий рейтинга («Общий рейтинг» + категории достижений). */
  categoryTabs: Tab[];
  activeCategory: string;
  /** Ключ поля с баллами: total_score либо <категория>_score по активной подвкладке. */
  scoreKey: string;
  direction: 'asc' | 'desc';
  /** Текущий срез таблицы для выгрузки в Excel (семестр/фильтры/категория/направление). */
  exportParams: ExportExcelParams;
  onCategoryChange: (id: string) => void;
  onDirectionToggle: () => void;
  onSearch: (value: string) => void;
  onPageChange: (page: number) => void;
}

/**
 * Вкладка «Студенты»: рейтинг за выбранный в фильтрах семестр с подвкладками
 * категорий, сортировкой по баллам и выгрузкой в Excel. Заменяет прежние
 * отдельные вкладки «Группа» и «Рейтинг».
 */
export default function StudentsTab({
  students,
  loading,
  totalStudents,
  currentPage,
  pageSize,
  isRectorate,
  selectedGroupId,
  currentGroupName,
  categoryTabs,
  activeCategory,
  scoreKey,
  direction,
  exportParams,
  onCategoryChange,
  onDirectionToggle,
  onSearch,
  onPageChange,
}: StudentsTabProps) {
  return (
    <div className="mt-5 animate-fade-in">
      <RatingTabs tabs={categoryTabs} activeTab={activeCategory} onChange={onCategoryChange} />

      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.10)] sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold text-slate-900 sm:text-base">
            {selectedGroupId === 'all' ? 'Все студенты' : `Список студентов группы ${currentGroupName}`}{' '}
            <span className="text-xs font-normal text-sky-700">
              (всего: {totalStudents})
            </span>
          </h2>
          <div className="flex items-center gap-2">
            <SearchInput onSearch={onSearch} placeholder="Поиск по ФИО или зачетке" />
            <ExportExcelButton {...exportParams} />
          </div>
        </div>

        <div className="mt-4 rounded-lg bg-white p-2 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
          <div className="w-full overflow-x-auto">
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
                    <th className="w-24 px-1.5 sm:px-2 md:px-3 lg:px-4 py-1.5 sm:py-2 md:py-2.5 lg:py-3 text-center text-[11px] sm:text-xs md:text-sm lg:text-base font-normal">
                      {/* Клик по заголовку переключает направление сортировки по баллам. */}
                      <button
                        type="button"
                        onClick={onDirectionToggle}
                        title={direction === 'asc' ? 'По возрастанию' : 'По убыванию'}
                        className="cursor-pointer inline-flex items-center gap-1 bg-transparent text-inherit hover:opacity-80"
                      >
                        Баллы
                        <i
                          className={`fa-solid ${direction === 'asc' ? 'fa-arrow-up-short-wide' : 'fa-arrow-down-wide-short'} text-[10px] sm:text-xs`}
                          aria-hidden="true"
                        />
                      </button>
                    </th>
                    <th className="w-20 px-1.5 sm:px-2 md:px-3 lg:px-4 py-1.5 sm:py-2 md:py-2.5 lg:py-3 text-right text-[11px] sm:text-xs md:text-sm lg:text-base font-normal rounded-r-lg">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody className={`transition-opacity duration-300 ${loading && students.length > 0 ? 'opacity-40' : 'opacity-100'}`}>
                  {students.length > 0 ? (
                    students.map((student, idx) => (
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
                          {Number(student[scoreKey])}
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
                ) : loading ? (
                  // Скелетон первой загрузки: строк ещё нет, показываем pageSize
                  // строк-заглушек. При пагинации и поиске строки уже есть,
                  // и работает затемнение tbody выше.
                  Array.from({ length: pageSize }).map((_, i) => (
                    <tr key={`sk-${i}`} className="border-b border-[#f0f0f0] last:border-b-0">
                      <td colSpan={isRectorate ? 8 : 7} className="p-2 md:px-4 md:py-3">
                        <div className="h-5 w-full animate-pulse rounded bg-slate-100" />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={isRectorate ? 8 : 7}
                      className="p-1 sm:p-2 md:px-4 md:py-3 text-center text-xs md:text-sm text-slate-500"
                    >
                      Студенты не найдены
                    </td>
                  </tr>
                )}
                </tbody>
              </table>

            <div className="border-t border-slate-200 pt-4">
              <Pagination
                page={currentPage}
                totalCount={totalStudents}
                pageSize={pageSize}
                loading={loading}
                onPageChange={onPageChange}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
