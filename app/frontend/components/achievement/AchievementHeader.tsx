import type { ReactNode } from 'react';

import type { PendingDocumentDto } from '@/lib/api';

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  approved: { label: 'Подтверждено', className: 'bg-emerald-100 text-emerald-800' },
  rejected: { label: 'Отклонено', className: 'bg-rose-100 text-rose-700' },
  pending: { label: 'На рассмотрении', className: 'bg-amber-100 text-amber-800' },
};

interface AchievementHeaderProps {
  doc: PendingDocumentDto;
  /** Заголовок страницы (у студента — «Моя заявка», у сотрудника — ФИО студента и т. п.). */
  title: ReactNode;
  /** Подпись статуса approved: в кабинете сотрудника — «Одобрено». */
  approvedLabel?: string;
  /** Действия справа: «Редактировать / Удалить» у студента. */
  actions?: ReactNode;
  children?: ReactNode;
}

/** Шапка заявки: заголовок, статус, баллы и семестр бейджами, место под действия. */
export default function AchievementHeader({ doc, title, approvedLabel, actions, children }: AchievementHeaderProps) {
  const status = STATUS_BADGE[doc.status_display ?? ''];
  const isRejected = doc.status_display === 'rejected';

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="break-words text-lg font-semibold text-slate-900 sm:text-xl md:text-2xl">{title}</h1>
          {children}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {status && (
              <span className={`rounded-full px-3 py-1 text-sm font-semibold ${status.className}`}>
                {doc.status_display === 'approved' && approvedLabel ? approvedLabel : status.label}
              </span>
            )}
            {isRejected ? (
              <span title="Баллы не начислены" className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
                <s>+{doc.score}</s>
                <span className="sr-only">баллы не начислены</span>
              </span>
            ) : (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-800">+{doc.score}</span>
            )}
            {doc.semester_label && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">{doc.semester_label}</span>
            )}
          </div>
        </div>
        {actions && <div className="flex flex-wrap gap-2 sm:justify-end">{actions}</div>}
      </div>
    </section>
  );
}
