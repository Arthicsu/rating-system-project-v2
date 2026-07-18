'use client';

import CustomSelect from '@/components/CustomSelect';
import Pagination from '@/components/Pagination';
import type { RatingFilterConfig } from '@/interfaces/RatingInterfaces';
import type Student from '@/interfaces/StudentInterfaces';

interface RatingTableProps {
  filters: RatingFilterConfig[];
  students: Student[];
  loading: boolean;
  /** Ключ поля с баллами: total_score либо <категория>_score по активной вкладке. */
  scoreKey: string;
  currentPage: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}

// Ширины трёх фильтровых колонок шапки; последняя закругляет правый край.
const FILTER_TH_WIDTHS = ['w-[20%]', 'w-[15%]', 'w-[20%] rounded-r-lg'];

/** Таблица рейтинга: фильтры в шапке, строки студентов, пагинация. */
export default function RatingTable({
  filters,
  students,
  loading,
  scoreKey,
  currentPage,
  pageSize,
  totalCount,
  onPageChange,
}: RatingTableProps) {
  return (
    <div className="rounded-lg bg-white p-2 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
      <div className="animate-fade-in w-full overflow-x-auto">
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

              {filters.map((f, i) => (
                <th
                  key={f.id}
                  className={`${FILTER_TH_WIDTHS[i]} sm:w-auto px-1.5 sm:px-2 md:px-3 lg:px-4 py-1.5 sm:py-2 md:py-2.5 lg:py-3 text-[11px] sm:text-xs md:text-sm lg:text-base font-normal`}
                >
                  <CustomSelect
                    id={`${f.id}-select`}
                    inline
                    label={f.label}
                    value={f.value}
                    disabled={f.disabled}
                    labelClassName="font-medium text-[9px] sm:text-[11px] md:text-xs lg:text-sm text-white"
                    triggerClassName="max-[411px]:hidden w-auto text-[9px] sm:text-[11px] md:text-xs lg:text-sm py-0.5 md:py-1 px-1 sm:px-1.5 md:px-2"
                    className="max-[544px]:flex-col"
                    options={f.options}
                    onChange={f.onChange}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={`transition-opacity duration-300 ${loading && students.length > 0 ? 'opacity-40' : 'opacity-100'}`}>
            {students.length > 0 ? (
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
            ) : loading ? (
              // Скелетон первой загрузки: строк ещё нет, показываем pageSize
              // строк-заглушек. При смене фильтров и страниц строки уже есть,
              // и работает затемнение tbody выше.
              Array.from({ length: pageSize }).map((_, i) => (
                <tr key={`sk-${i}`} className="border-b border-[#0068a825] last:border-b-0">
                  <td colSpan={6} className="p-2 md:px-4 md:py-3">
                    <div className="h-5 w-full animate-pulse rounded bg-slate-100" />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={6}
                  className="p-20 text-center text-xs md:text-xl text-slate-500"
                >
                  Студенты не найдены
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Pagination
          page={currentPage}
          totalCount={totalCount}
          pageSize={pageSize}
          loading={loading}
          onPageChange={onPageChange}
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
  );
}
