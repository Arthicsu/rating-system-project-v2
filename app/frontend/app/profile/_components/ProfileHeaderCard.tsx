import type { Profile } from '@/interfaces/ProfileInterfaces';

/** Шапка профиля: ФИО, зачётка, факультет и общий балл. */
export default function ProfileHeaderCard({ profile }: { profile: Profile }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1.5">
        <h1 className="text-lg font-semibold text-slate-900 sm:text-xl md:text-2xl">
          {profile.full_name}
        </h1>
        <p className="text-xs text-slate-500 sm:text-sm">
          Зачетная книжка:{' '}
          <span className="font-medium text-slate-800">
            {profile.record_book || '—'}
          </span>
        </p>
        <p className="text-xs text-slate-500 sm:text-sm">
          {profile.faculty}{' '}
          <span className="mx-1 text-slate-300">•</span>
          {profile.course} курс
          <span className="mx-1 text-slate-300">•</span>
          группа {profile.group}
        </p>
      </div>
      <div className="mt-2 flex items-center justify-start sm:mt-0 sm:justify-end">
        <div className="rounded-2xl border items-center border-sky-100 bg-sky-50 px-4 py-3 text-center shadow-sm">
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Общий балл
          </div>
          <div className="text-2xl font-bold text-sky-700 sm:text-3xl">
            {profile.total_score}
          </div>
        </div>
      </div>
    </div>
  );
}
