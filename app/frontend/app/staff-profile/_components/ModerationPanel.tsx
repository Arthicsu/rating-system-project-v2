'use client';

import Link from 'next/link';

import type { Document, ReviewAction } from '@/interfaces/StaffInterfaces';
import { ActionButtons } from './RequestCard';

interface ModerationPanelProps {
  doc: Document;
  /** Решения по правилам варианта А для роли и статуса (useReviewActions.actionsFor). */
  actions: ReviewAction[];
  onAction: (action: ReviewAction, doc: Document) => void;
}

const STATUS_WORD: Record<string, string> = { approved: 'одобрена', rejected: 'отклонена' };

/** Панель решения на странице заявки: кнопки по правилам или пояснение, почему их нет. */
export default function ModerationPanel({ doc, actions, onAction }: ModerationPanelProps) {
  const note =
    doc.status_display === 'pending'
      ? 'Заявка на рассмотрении у кафедры.'
      : `Действий нет: заявка ${STATUS_WORD[doc.status_display] ?? 'рассмотрена'}.`;

  return (
    // На десктопе панель остаётся видна при прокрутке сведений; на телефоне — сразу под шапкой.
    <section
      aria-label="Решение по заявке"
      className="z-10 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5 lg:sticky lg:top-24"
    >
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Решение</h2>
      {actions.length > 0 ? (
        <ActionButtons doc={doc} actions={actions} onAction={onAction} />
      ) : (
        <p className="mt-2 text-sm text-slate-700">{note}</p>
      )}
      <Link
        href="/staff-profile?tab=pending-requests"
        className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-sky-700 hover:text-sky-900"
      >
        К списку заявок
      </Link>
    </section>
  );
}
