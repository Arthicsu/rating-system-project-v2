import type { ReactNode } from 'react';

import Card from '@/components/Card';
import { PAGE_TITLE } from '@/components/layout/PageHeader';
import type { PendingDocumentDto } from '@/lib/api';

export const STATUS_BADGE: Record<string, { label: string; className: string }> = {
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
  /** Действия под метками: «Редактировать / Удалить» у студента. */
  actions?: ReactNode;
  children?: ReactNode;
}

/** Шапка заявки: заголовок, статус, баллы и семестр бейджами, под ними — действия. */
export default function AchievementHeader({ doc, title, approvedLabel, actions, children }: AchievementHeaderProps) {
  const status = STATUS_BADGE[doc.status_display ?? ''];
  const isRejected = doc.status_display === 'rejected';

  return (
    <Card as="section">
      <h1 className={`break-words ${PAGE_TITLE}`}>{title}</h1>
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
      {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
    </Card>
  );
}
