'use client';

import { useCategories } from '@/hooks/queries/useLookups';
import type { DashboardStats, StudentSimple } from '@/interfaces/StaffInterfaces';

interface StatisticsTabProps {
  stats: DashboardStats;
  top5: StudentSimple[];
  activeRequests: number;
  currentGroupName: string;
  semesterLabel: string;
}

/** Вкладка «Статистика». */
export default function StatisticsTab({ stats, top5, activeRequests, currentGroupName, semesterLabel }: StatisticsTabProps) {
  const { data: categoriesData = [] } = useCategories();

  // Суммы баллов приходят с бэка по кодам категорий; раскладываем их по
  // человеческим меткам для строк распределения ниже.
  const categories: Record<string, number> = {};
  categoriesData.forEach((cat) => {
    categories[cat.label] = stats.categories?.[cat.code] ?? 0;
  });

  return (
    <div className="mt-5 animate-fade-in">
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.10)] sm:p-5">
        <h2 className="mb-5 text-sm font-semibold text-slate-900 sm:text-base">
          Аналитика: {currentGroupName}{' '}
          <span className="text-xs font-normal text-sky-700 sm:text-sm">
            ({semesterLabel})
          </span>
        </h2>

        <div className="mb-6 grid gap-3 grid-cols-2 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5 sm:p-4">
            <div className="text-[11px] font-medium uppercase tracking-wide text-sky-700">
              Студентов
            </div>
            <div className="mt-1 text-2xl font-bold text-sky-700">
              {stats.total_students}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5 sm:p-4">
            <div className="text-[11px] font-medium uppercase tracking-wide text-sky-700">
              Средний балл
            </div>
            <div className="mt-1 text-2xl font-bold text-sky-700">
              {stats.avg_score}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5 sm:p-4">
            <div className="text-[11px] font-medium uppercase tracking-wide text-sky-700">
              Максимальный / Минимальный
            </div>
            <div className="mt-1 text-lg font-semibold text-slate-900">
              {stats.max_score}{' '}
              <span className="mx-1 text-slate-300">|</span>
              {stats.min_score}
            </div>
          </div>
          <div className="rounded-2xl border-l-4 border-rose-500 bg-rose-50 p-3.5 sm:p-4">
            <div className="text-[11px] font-medium uppercase tracking-wide text-rose-600">
              Активные заявки
            </div>
            <div className="mt-1 text-2xl font-bold text-rose-600">
              {activeRequests}
            </div>
          </div>
        </div>

        <div className="grid gap-5 grid-cols-1 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:p-5">
            <h3 className="mb-4 border-b border-slate-200 pb-2 text-sm font-semibold text-slate-900">
              Распределение баллов по группе
            </h3>
            <div className="space-y-3">
              {Object.entries(categories).map(
                ([label, value]) => {
                  const percentage =
                    stats.avg_score > 0
                      ? Math.min(
                          (value /
                            (stats.avg_score *
                              stats.total_students)) *
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
                  {top5.map((student, idx) => (
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
  );
}
