'use client';

import Link from 'next/link';

import { useCategories } from '@/hooks/queries';
import type { DashboardStats, StudentSimple } from '@/interfaces/StaffInterfaces';

interface StatisticsTabProps {
  stats: DashboardStats;
  top5: StudentSimple[];
  /** Очередь сотрудника: у кафедры ждут решения, у руководства — «На контроле». */
  activeRequests: number;
  isLeadership: boolean;
  /** По каким студентам считано: факультет / курс / группа или «Все студенты». */
  scopeLabel: string;
  periodLabel: string;
}

function StatCard({ label, value, accent = false }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-3.5 sm:p-4 ${accent ? 'border-rose-200 bg-rose-50' : 'border-slate-100 bg-slate-50'}`}>
      <div className={`text-xs font-medium uppercase tracking-wide ${accent ? 'text-rose-700' : 'text-sky-700'}`}>{label}</div>
      <div className={`mt-1 text-2xl font-bold ${accent ? 'text-rose-700' : 'text-sky-700'}`}>{value}</div>
    </div>
  );
}

/** Вкладка «Статистика»: баллы студентов и ход модерации за выбранный период. */
export default function StatisticsTab({
  stats,
  top5,
  activeRequests,
  isLeadership,
  scopeLabel,
  periodLabel,
}: StatisticsTabProps) {
  const { data: categoriesData = [] } = useCategories();
  const m = stats.moderation;

  // Суммы баллов приходят с бэка по кодам категорий; доля — от суммы по всем категориям.
  const categories = categoriesData.map((cat) => ({ label: cat.label, value: stats.categories?.[cat.code] ?? 0 }));
  const totalPoints = categories.reduce((sum, c) => sum + c.value, 0);

  return (
    <div className="mt-5 animate-fade-in">
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.10)] sm:p-5">
        <h2 className="mb-5 text-sm font-semibold text-slate-900 sm:text-base">
          Статистика: {scopeLabel}{' '}
          <span className="text-xs font-normal text-sky-700 sm:text-sm">({periodLabel})</span>
        </h2>

        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
          <StatCard label="Студентов" value={stats.total_students} />
          <StatCard label="Средний балл" value={stats.avg_score} />
          <StatCard
            label="Максимальный / Минимальный"
            value={
              <span className="text-lg font-semibold text-slate-900">
                {stats.max_score} <span className="mx-1 text-slate-300">|</span> {stats.min_score}
              </span>
            }
          />
        </div>

        <h3 className="mb-3 text-sm font-semibold text-slate-900">Заявки за период</h3>
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Подано" value={m.submitted} />
          <StatCard label="Одобрено" value={m.approved} />
          <StatCard label="Отклонено" value={m.rejected} />
          <StatCard label="Ждут решения кафедры" value={m.pending} accent={!isLeadership && m.pending > 0} />
          <StatCard label="Из них повторные и возвращённые" value={m.returned} />
          {/* От первой подачи: у повторно поданной ожидание после исправления может быть меньше. */}
          <StatCard
            label="Самая ранняя из ждущих"
            value={m.oldest_pending_days === null ? '—' : `подана ${m.oldest_pending_days} дн. назад`}
          />
          {isLeadership && <StatCard label="На контроле" value={activeRequests} />}
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:p-5">
            <h3 className="mb-4 border-b border-slate-200 pb-2 text-sm font-semibold text-slate-900">
              Распределение баллов по категориям
            </h3>
            <div className="space-y-3">
              {categories.map(({ label, value }) => {
                const percentage = totalPoints > 0 ? Math.round((value / totalPoints) * 100) : 0;
                return (
                  <div key={label}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-sm text-slate-800">
                      <span>{label}</span>
                      <span className="whitespace-nowrap">
                        <strong className="text-slate-900">{value} б.</strong>
                        <span className="ml-1.5 text-slate-600">{percentage}%</span>
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
                      <div
                        className="h-full rounded-full bg-sky-700 transition-[width] duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:p-5">
            <h3 className="mb-4 border-b border-slate-200 pb-2 text-sm font-semibold text-slate-900">
              Топ-5 студентов по баллам
            </h3>
            <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white">
              <table className="min-w-full text-left text-sm text-sky-700">
                <thead className="bg-sky-700 text-xs font-semibold uppercase tracking-wide text-white">
                  <tr>
                    <th className="px-4 py-2.5">Место</th>
                    <th className="px-4 py-2.5">ФИО</th>
                    <th className="px-4 py-2.5">Балл</th>
                  </tr>
                </thead>
                <tbody>
                  {top5.map((student, idx) => (
                    <tr key={student.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                      <td className="px-4 py-2.5">
                        <span className="inline-flex min-w-[2.2rem] justify-center rounded-md bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">
                          {idx + 1}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-sm">
                        <Link href={`/profile/${student.id}`} className="text-sky-700 hover:text-sky-900 hover:underline">
                          {student.full_name}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-sm font-semibold text-sky-700">{student.total_score}</td>
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
