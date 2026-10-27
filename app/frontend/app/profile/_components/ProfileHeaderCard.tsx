import type { Profile } from '@/interfaces/ProfileInterfaces';

/**
 * Шапка профиля: ФИО, зачётка, факультет и общий балл.
 * Кнопка «Сменить пароль» - только когда передан onChangePassword (свой профиль студента).
 */
export default function ProfileHeaderCard({
  profile,
  onChangePassword,
}: {
  profile: Profile;
  onChangePassword?: () => void;
}) {
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
        {/* {onChangePassword && (
          <button
            type="button"
            onClick={onChangePassword}
            className="cursor-pointer mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 sm:min-h-9"
          >
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="11" width="16" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            Сменить пароль
          </button>
        )} */}
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
