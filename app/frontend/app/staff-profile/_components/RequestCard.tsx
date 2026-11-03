'use client';

import Link from 'next/link';

import Button, { type ButtonSize, type ButtonVariant } from '@/components/Button';
import Card from '@/components/Card';
import type { Document, ReviewAction } from '@/interfaces/StaffInterfaces';

interface RequestCardProps {
  doc: Document;
  variant: 'pending' | 'reviewed';
  /** Решения, доступные сотруднику для этой заявки (useReviewActions.actionsFor). */
  actions: ReviewAction[];
  onAction: (action: ReviewAction, doc: Document) => void;
}

const ACTION_BUTTONS: Record<ReviewAction, { label: string; variant: ButtonVariant }> = {
  approve: { label: 'Одобрить', variant: 'approve' },
  reject: { label: 'Отклонить', variant: 'danger' },
  return: { label: 'Вернуть кафедре', variant: 'return' },
};

// Метка целиком в одну строку; переносится весь ряд меток. Крупным шрифтом длинная метка шире карточки - переносится и текст.
const BADGE =
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold low-vision:whitespace-normal';

/** Кнопки решений по заявке (карточка и страница заявки сотрудника). */
export function ActionButtons({
  doc,
  actions,
  onAction,
  size = 'md',
}: Pick<RequestCardProps, 'doc' | 'actions' | 'onAction'> & { size?: ButtonSize }) {
  if (actions.length === 0) return null;
  return (
    // Не влезают в ряд (крупный шрифт) — кнопки встают друг под другом, а не рвут слова по буквам.
    <div className="mt-2 flex flex-wrap gap-2">
      {actions.map((action) => (
        <Button
          key={action}
          variant={ACTION_BUTTONS[action].variant}
          size={size}
          // flex-auto: ширина по подписи — «Вернуть кафедре» не переносится рядом с короткой «Отклонить».
          className="flex-auto"
          onClick={() => onAction(action, doc)}
        >
          {ACTION_BUTTONS[action].label}
        </Button>
      ))}
    </div>
  );
}

/**
 * Метка истории заявки на рассмотрении. Причина прошлого отклонения сохраняется при повторной
 * подаче: заявку уже отклоняли. Сам текст причины - на странице заявки, в карточке только
 * компактная метка. Возврат руководством - своя метка: решение кафедры отменили сверху.
 */
function HistoryMark({ doc }: { doc: Document }) {
  if (doc.returned_by) {
    return (
      <span title="Руководство вернуло заявку на повторное рассмотрение" className={`${BADGE} bg-rose-100 text-rose-700`}>
        <i className="fa-solid fa-reply" aria-hidden="true" />
        {doc.returned_by === 'Dean' ? 'Возвращена деканатом' : 'Возвращена ректоратом'}
      </span>
    );
  }
  if (doc.rejection_reason) {
    return (
      <span title="Заявка уже отклонялась" className={`${BADGE} bg-rose-100 text-rose-700`}>
        <i className="fa-solid fa-rotate-left" aria-hidden="true" />
        Повторно
      </span>
    );
  }
  return null;
}

/** Карточка заявки: ФИО целиком, метки отдельным рядом, группа/курс и дата подачи. */
export default function RequestCard({ doc, variant, actions, onAction }: RequestCardProps) {
  const isRejected = doc.status_display === 'rejected';
  // Группа и курс важны при «Все группы»: без них карточки разных групп не отличить.
  const studentMeta = [doc.record_book, doc.group, doc.course ? `${doc.course} курс` : null]
    .filter(Boolean)
    .join(' · ');
  const uploaded = new Date(doc.uploaded_at).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' });

  return (
    <Card padding="sm" className="flex flex-col transition-shadow hover:shadow-md">
      {/* Поля с отрицательными отступами: цель нажатия 44px на телефоне и 24px на ПК, а карточка не растёт. */}
      <Link
        href={`/profile/${doc.student_id}`}
        className="relative -my-3 self-start break-words py-3 text-sm font-semibold text-sky-700 underline-offset-2 hover:text-sky-900 hover:underline sm:-my-0.5 sm:py-0.5 [[data-lv-scheme]_&]:underline"
      >
        {doc.student_name}
      </Link>
      <p className="text-xs text-slate-600">{studentMeta}</p>

      <div className="mt-2 flex flex-wrap items-center gap-1">
        {variant === 'reviewed' ? (
          <span className={`${BADGE} ${isRejected ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
            {isRejected ? 'Отклонена' : 'Одобрена'}
          </span>
        ) : (
          <HistoryMark doc={doc} />
        )}
        <span className={`${BADGE} bg-amber-100 text-amber-800`}>{doc.category_display}</span>
        {/* У отклонённой баллы не начислены: серые и зачёркнутые, а не зелёные «+N». */}
        {isRejected ? (
          <span title="Баллы не начислены" className={`${BADGE} bg-slate-100 text-slate-600`}>
            <s>+{doc.score}</s>
            <span className="sr-only">баллы не начислены</span>
          </span>
        ) : (
          <span className={`${BADGE} bg-emerald-100 text-emerald-700`}>+{doc.score}</span>
        )}
      </div>

      <p className="mt-2 line-clamp-2 break-words text-sm text-slate-800">{doc.achievement}</p>

      {variant === 'reviewed' && isRejected && doc.rejection_reason && (
        <p className="mt-1 line-clamp-2 break-words text-xs text-rose-700">Причина: {doc.rejection_reason}</p>
      )}

      {/* mt-auto: кнопки карточек одного ряда сетки стоят на одной линии. */}
      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1.5">
        <p className="text-xs text-slate-600">
          {doc.level_display ? `${doc.level_display} · подана ${uploaded}` : `Подана ${uploaded}`}
        </p>
        {doc.files && doc.files.length > 0 && (
          <span className="text-xs text-slate-600">
            <i className="fa-solid fa-file mr-1" aria-hidden="true" />
            Файлов: {doc.files.length}
          </span>
        )}
        <Link
          href={`/staff-profile/requests/${doc.id}`}
          className="ml-auto inline-flex min-h-11 items-center text-xs font-semibold text-sky-700 hover:text-sky-900 sm:min-h-6"
        >
          Подробнее
        </Link>
      </div>

      <ActionButtons doc={doc} actions={actions} onAction={onAction} size="sm" />
    </Card>
  );
}
