'use client';

import Link from 'next/link';

import type { Document } from '@/interfaces/StaffInterfaces';

interface RequestCardProps {
  doc: Document;
  variant: 'pending' | 'reviewed';
  /** pending: показывать ли кнопку «Одобрить» (роль Department или не-руководство). */
  canApprove?: boolean;
  onApprove: (doc: Document) => void;
  onReject: (doc: Document) => void;
}

/** Карточка заявки. JSX перенесён дословно из staff-profile/page.tsx (вкладки pending/reviewed). */
export default function RequestCard({ doc, variant, canApprove, onApprove, onReject }: RequestCardProps) {
  if (variant === 'reviewed') {
    const isApproved = doc.status_display === 'approved';

    return (
      <div
        className="flex flex-col rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-[0_4px_12px_rgba(15,23,42,0.08)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.12)] transition-shadow"
      >
        <div className="flex-1 mb-2 flex flex-col gap-1.5">
          <div className="flex max-[941px]:flex-col items-start justify-between gap-1 sm:gap-2">
            <div className="flex-1 min-w-0">
              <Link
                href={`/profile/${doc.student_id}`}
                className="text-xs font-semibold text-sky-700 hover:text-sky-900 hover:underline sm:text-sm sm:line-clamp-1"
              >
                {doc.student_name}
              </Link>
              <p className="text-[10px] text-sky-700 sm:text-xs">{doc.record_book}</p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold sm:text-xs ${
                  isApproved
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-rose-100 text-rose-700'
                }`}
              >
                {isApproved ? 'Подтверждена' : 'Отклонена'}
              </span>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-small text-amber-700">
                {doc.category_display}
              </span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.25 text-[10px] font-semibold text-emerald-700 sm:text-xs">
                +{doc.score}
              </span>
            </div>
          </div>
        </div>

        <div className="mb-2">
          <p className="text-xs text-slate-800 sm:text-sm line-clamp-2">{doc.achievement}</p>
        </div>

        {!isApproved && doc.rejection_reason && (
          <p className="mb-2 text-[10px] text-rose-600 sm:text-xs line-clamp-2">
            Причина: {doc.rejection_reason}
          </p>
        )}

        <div className="flex items-center justify-between">
          {doc.files && doc.files.length > 0 && (
            <span className="text-[10px] text-sky-700 sm:text-xs">
              <i className="fa-solid fa-file mr-1" />
              Файлов: {doc.files.length}
            </span>
          )}
          <Link
            href={`/achievement/${doc.id}`}
            className="cursor-pointer ml-auto text-[10px] font-semibold text-sky-700 hover:text-sky-900 sm:text-xs"
          >
            Подробнее
          </Link>
        </div>

        <div className="mt-3 flex gap-2">
          {!isApproved && (
            <button
              type="button"
              onClick={() => onApprove(doc)}
              className="cursor-pointer flex-1 rounded-lg bg-emerald-600 px-2 py-1.5 text-[10px] font-semibold text-white shadow-sm transition hover:bg-emerald-700 sm:text-xs"
            >
              Одобрить
            </button>
          )}
          {isApproved && (
            <button
              type="button"
              onClick={() => onReject(doc)}
              className="cursor-pointer flex-1 rounded-lg bg-rose-600 px-2 py-1.5 text-[10px] font-semibold text-white shadow-sm transition hover:bg-rose-700 sm:text-xs sm:px-3 sm:py-2"
            >
              Отклонить
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-[0_4px_12px_rgba(15,23,42,0.08)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.12)] transition-shadow"
    >
      <div className="flex-1 mb-2 flex flex-col gap-1.5">
        <div className="flex max-[941px]:flex-col items-start justify-between gap-1 sm:gap-2">
          <div className="flex-1 min-w-0">
            <Link
              href={`/profile/${doc.student_id}`}
              className="text-xs font-semibold text-sky-700 hover:text-sky-900 hover:underline sm:text-sm sm:line-clamp-1"
            >
              {doc.student_name}
            </Link>
            <p className="text-[10px] text-sky-700 sm:text-xs">{doc.record_book}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs sm:text-xs font-small text-amber-700">
              {doc.category_display}
            </span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.25 text-[10px] font-semibold text-emerald-700 sm:text-xs">
              +{doc.score}
            </span>
          </div>
        </div>
      </div>

      <div className="mb-2">
        <p className="text-xs text-slate-800 sm:text-sm line-clamp-2">{doc.achievement}</p>
      </div>

      <div className="flex items-center justify-between">
        {doc.files && doc.files.length > 0 && (
          <span className="text-[10px] text-sky-700 sm:text-xs">
            <i className="fa-solid fa-file mr-1" />
            Прикреплённых файл(ов): {doc.files.length}
          </span>
        )}
        {doc.rejection_reason && (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700 sm:text-xs">
            <i className="fa-solid fa-circle-exclamation" />
            Была отклонена
          </span>
        )}
        <Link
          href={`/achievement/${doc.id}`}
          className="cursor-pointer ml-auto text-[10px] font-semibold text-sky-700 hover:text-sky-900 sm:text-xs"
        >
          Подробнее
        </Link>
      </div>

      <div className="mt-3 flex gap-2">
        {canApprove && (
          <button
            type="button"
            onClick={() => onApprove(doc)}
            className="cursor-pointer flex-1 rounded-lg bg-emerald-600 px-2 py-1.5 text-[10px] font-semibold text-white shadow-sm transition hover:bg-emerald-700 sm:text-xs"
          >
            Одобрить
          </button>
        )}
        <button
          type="button"
          onClick={() => onReject(doc)}
          className="cursor-pointer flex-1 rounded-lg bg-rose-600 px-2 py-1.5 text-[10px] font-semibold text-white shadow-sm transition hover:bg-rose-700 sm:text-xs sm:px-3 sm:py-2"
        >
          Отклонить
        </button>
      </div>
    </div>
  );
}
