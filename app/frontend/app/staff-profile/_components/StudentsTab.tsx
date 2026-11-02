'use client';

import Link from 'next/link';

import Button from '@/components/Button';
import Card, { CARD_TITLE } from '@/components/Card';
import SearchInput from '@/components/SearchInput';
import ExportExcelButton from '@/components/ExportExcelButton';
import Pagination from '@/components/Pagination';
import { Bone, BoneLine } from '@/components/Skeleton';
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
  /** Уже применённый поиск - поле показывает его после смены вкладки и при открытии по ссылке. */
  searchValue: string;
  onSearch: (value: string) => void;
  onPageChange: (page: number) => void;
}

// inline-flex и min-размеры: трёхзначное место с крупным шрифтом растит кружок, а не вылезает из него.
const PLACE =
  'inline-flex min-h-7 min-w-7 shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-sky-700 px-1 align-middle text-xs font-bold text-white';
// В контрастной схеме весь текст одного цвета: ссылку ФИО выдаёт подчёркивание.
const NAME_LINK = 'font-medium text-sky-700 underline-offset-2 hover:text-sky-900 hover:underline [[data-lv-scheme]_&]:underline';
const TH = 'px-3 py-2.5 text-xs font-normal md:text-sm';
const TD = 'px-3 py-2 text-sm';

/**
 * Вкладка «Студенты»: рейтинг за выбранный в фильтрах семестр с подвкладками
 * категорий, сортировкой по баллам и выгрузкой в Excel. Заменяет прежние
 * отдельные вкладки «Группа» и «Рейтинг». До 640px вместо таблицы — список.
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
  searchValue,
  onSearch,
  onPageChange,
}: StudentsTabProps) {
  const firstPlace = (currentPage - 1) * pageSize + 1;
  const columns = isRectorate ? 7 : 6;
  const sortIcon = `fa-solid ${direction === 'asc' ? 'fa-arrow-up-short-wide' : 'fa-arrow-down-wide-short'}`;
  const dimmed = loading && students.length > 0 ? 'opacity-40' : 'opacity-100';

  return (
    <div className="mt-4 animate-fade-in">
      <RatingTabs tabs={categoryTabs} activeTab={activeCategory} onChange={onCategoryChange} />

      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className={CARD_TITLE}>
              {selectedGroupId === 'all' ? 'Все студенты' : `Список студентов группы ${currentGroupName}`}{' '}
              <span className="text-xs font-normal text-sky-700">
                (всего: {totalStudents})
              </span>
            </h2>
            {/* Сортировка серверная по всему списку; при равных баллах порядок по ФИО — подсказка,
                чтобы «одинаковый» список при нулевых баллах не выглядел несортированным. */}
            <p className="mt-0.5 text-xs text-slate-600">
              {direction === 'desc' ? 'По убыванию' : 'По возрастанию'} баллов по всему списку, при равных баллах — по ФИО
            </p>
          </div>
          {/* Поиск растягивается: на телефоне во всю ширину, на десктопе — широкое поле рядом с выгрузкой. */}
          {/* min-w-48 у поиска: с крупным шрифтом выгрузка переносится на строку ниже, а не сжимает поле. */}
          <div className="flex w-full flex-wrap items-center justify-end gap-2 md:w-[26rem] lg:w-[32rem]">
            <div className="flex min-w-48 flex-1">
              <SearchInput initialValue={searchValue} onSearch={onSearch} placeholder="ФИО или зачётка" />
            </div>
            <ExportExcelButton {...exportParams} />
          </div>
        </div>

        <div className="mt-3 flex justify-end sm:hidden">
          <Button
            variant="secondary"
            size="sm"
            onClick={onDirectionToggle}
            aria-label={direction === 'desc' ? 'Баллы: по убыванию' : 'Баллы: по возрастанию'}
          >
            Баллы
            <i className={sortIcon} aria-hidden="true" />
          </Button>
        </div>

        <div className="mt-3 hidden overflow-x-auto sm:block">
          <table aria-busy={loading} className="min-w-full border-collapse" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr className="bg-sky-700 text-white">
                <th className={`w-12 rounded-l-lg text-left ${TH}`}>
                  <span className="sr-only">Место</span>
                </th>
                <th className={`text-left ${TH}`}>ФИО студента</th>
                <th className={`w-[18%] text-left ${TH}`}>Зачетная книжка</th>
                {isRectorate && <th className={`w-[12%] text-left ${TH}`}>Факультет</th>}
                <th className={`w-16 text-center ${TH}`}>Курс</th>
                <th className={`w-[14%] text-left ${TH}`}>Группа</th>
                <th className={`w-24 rounded-r-lg text-center ${TH}`}>
                  {/* Клик по заголовку переключает направление сортировки по баллам. */}
                  <button
                    type="button"
                    onClick={onDirectionToggle}
                    title={direction === 'asc' ? 'По возрастанию' : 'По убыванию'}
                    className="cursor-pointer inline-flex items-center gap-1 bg-transparent text-inherit hover:opacity-80"
                  >
                    Баллы
                    <i className={`${sortIcon} text-xs`} aria-hidden="true" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className={`stagger transition-opacity duration-300 ${dimmed}`}>
              {students.length > 0 ? (
                students.map((student, idx) => (
                  <tr key={student.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                    <td className={`text-center align-middle ${TD}`}>
                      <span className={PLACE}>{firstPlace + idx}</span>
                    </td>
                    <td className={`overflow-hidden text-left ${TD}`}>
                      <Link href={`/profile/${student.id}`} className={`inline-block max-w-full py-0.5 ${NAME_LINK}`}>
                        <span className="block truncate md:hidden">{student.short_name}</span>
                        <span className="hidden md:inline">{student.full_name}</span>
                      </Link>
                    </td>
                    <td className={`text-left ${TD}`}>{student.record_book}</td>
                    {isRectorate && <td className={`text-left ${TD}`}>{student.faculty}</td>}
                    <td className={`text-center ${TD}`}>{student.course}</td>
                    <td className={`text-left ${TD}`}>{student.group}</td>
                    <td className={`text-center font-bold text-sky-700 ${TD}`}>{Number(student[scoreKey])}</td>
                  </tr>
                ))
              ) : loading ? (
                // Скелетон первой загрузки: строк ещё нет, показываем pageSize
                // строк-заглушек. При пагинации и поиске строки уже есть,
                // и работает затемнение tbody выше.
                Array.from({ length: pageSize }).map((_, i) => (
                  <tr key={`sk-${i}`} aria-hidden="true" className="skeleton-screen border-b border-slate-100 last:border-b-0">
                    <td className={TD}>
                      <Bone className="mx-auto size-7 rounded-full" />
                    </td>
                    {Array.from({ length: columns - 1 }, (_, j) => (
                      <td key={j} className={TD}>
                        <BoneLine className="w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns} className={`text-center text-slate-500 ${TD}`}>
                    Студенты не найдены
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <ol
          start={firstPlace}
          aria-busy={loading}
          className={`stagger mt-1 divide-y divide-slate-100 transition-opacity duration-300 motion-reduce:transition-none sm:hidden ${dimmed}`}
        >
          {students.length > 0 ? (
            students.map((student, idx) => (
              <li key={student.id} className="relative flex items-center gap-3 py-2.5">
                <span className={PLACE}>
                  <span className="sr-only">Место </span>
                  {firstPlace + idx}
                </span>
                <div className="min-w-0 flex-1">
                  {/* Ссылка растянута на всю строку (after): строка — цель нажатия не меньше 44px. */}
                  <Link
                    href={`/profile/${student.id}`}
                    className={`block truncate text-sm after:absolute after:inset-0 low-vision:whitespace-normal ${NAME_LINK}`}
                  >
                    {student.short_name}
                  </Link>
                  <p className="text-xs text-slate-600">
                    {[
                      student.record_book,
                      student.group,
                      student.course ? `${student.course} курс` : null,
                      isRectorate ? student.faculty : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <span className="shrink-0 text-base font-bold tabular-nums text-sky-700">
                  <span className="sr-only">Баллы: </span>
                  {Number(student[scoreKey])}
                </span>
              </li>
            ))
          ) : loading ? (
            Array.from({ length: pageSize }).map((_, i) => (
              <li key={`sk-${i}`} aria-hidden="true" className="skeleton-screen flex items-center gap-3 py-2.5">
                <Bone className="size-7 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1">
                  <BoneLine className="w-3/5 text-sm" />
                  <BoneLine className="w-4/5 text-xs" />
                </div>
                <BoneLine className="w-8 shrink-0 text-base" />
              </li>
            ))
          ) : (
            <li className="py-3 text-center text-sm text-slate-500">Студенты не найдены</li>
          )}
        </ol>

        <div className="mt-3 border-t border-slate-200 pt-3">
          <Pagination
            page={currentPage}
            totalCount={totalStudents}
            pageSize={pageSize}
            loading={loading}
            onPageChange={onPageChange}
          />
        </div>
      </Card>
    </div>
  );
}
