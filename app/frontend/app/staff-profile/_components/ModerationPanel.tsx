'use client';

import Link from 'next/link';

import Card, { CARD_TITLE } from '@/components/Card';
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
    <Card as="section" aria-label="Решение по заявке" className="z-10 lg:sticky lg:top-24">
      <h2 className={CARD_TITLE}>Решение</h2>
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
    </Card>
  );
}
