import type { PaginationProps } from '@/interfaces/RatingInterfaces';
import { pageWindow } from '@/lib/pagination';

const BUTTON =
  'cursor-pointer h-11 min-w-11 items-center justify-center rounded-lg border px-2 text-sm font-medium transition active:scale-95 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100';
const IDLE = 'border-slate-300 bg-white text-slate-600 enabled:hover:bg-slate-50';

/**
 * Пагинация списков: «Показано a–b из n» (скринридер слышит смену), стрелки и номера страниц;
 * на телефоне вместо номеров - «N из M». Кнопки 44px.
 */
export default function Pagination({ page, totalCount, pageSize, loading, onPageChange }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(totalCount / pageSize));
  const go = (n: number) => {
    if (n !== page) onPageChange(n);
  };

  return (
    <nav aria-label="Страницы" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-2">
      <p aria-live="polite" className="text-xs text-slate-500">
        Показано {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalCount)} из {totalCount}
      </p>

      <div className="flex items-center gap-1.5 max-sm:w-full max-sm:justify-between">
        <button
          type="button"
          onClick={() => go(page - 1)}
          disabled={page <= 1 || loading}
          aria-label="Предыдущая страница"
          className={`${BUTTON} ${IDLE} inline-flex`}
        >
          <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <span className="text-sm font-medium text-slate-700 sm:hidden">
          {page} из {pages}
        </span>
        {pageWindow(page, pages).map((n, i) =>
          n === '…' ? (
            <span key={`gap-${i}`} aria-hidden="true" className="hidden w-6 text-center text-slate-400 sm:inline">
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              onClick={() => go(n)}
              disabled={loading}
              aria-label={`Страница ${n}`}
              aria-current={n === page ? 'page' : undefined}
              className={`${BUTTON} hidden sm:inline-flex ${n === page ? 'border-sky-700 bg-sky-700 text-white' : IDLE}`}
            >
              {n}
            </button>
          ),
        )}

        <button
          type="button"
          onClick={() => go(page + 1)}
          disabled={page >= pages || loading}
          aria-label="Следующая страница"
          className={`${BUTTON} ${IDLE} inline-flex`}
        >
          <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </nav>
  );
}
