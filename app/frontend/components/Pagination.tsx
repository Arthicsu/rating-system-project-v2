import type { PaginationProps } from '@/interfaces/RatingInterfaces'
 
export default function Pagination({ page, totalCount, pageSize, loading, onPageChange }: PaginationProps) {
  // const totalPages = Math.ceil(totalCount / pageSize);
  return (
    <div className="flex items-center justify-between px-2">
      <div className="text-xs text-slate-500">
        Показано {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalCount)} из {totalCount}
      </div>
      
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(Math.max(page - 1, 1))}
          disabled={page === 1 || loading}
          className="flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Предыдущая страница"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex h-8 items-center px-3 text-sm font-medium text-slate-700">
          {page}
        </div>

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page * pageSize >= totalCount || loading}
          className="flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Следующая страница"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}