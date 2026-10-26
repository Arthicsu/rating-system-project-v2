'use client';

import Link from 'next/link';

import type { Document, ReviewAction } from '@/interfaces/StaffInterfaces';

interface RequestCardProps {
  doc: Document;
  variant: 'pending' | 'reviewed';
  /** Решения, доступные сотруднику для этой заявки (useReviewActions.actionsFor). */
  actions: ReviewAction[];
  onAction: (action: ReviewAction, doc: Document) => void;
}

const ACTION_BUTTONS: Record<ReviewAction, { label: string; className: string }> = {
  approve: { label: 'Одобрить', className: 'bg-emerald-700 hover:bg-emerald-800' },
  reject: { label: 'Отклонить', className: 'bg-rose-600 hover:bg-rose-700' },
  return: { label: 'Вернуть кафедре', className: 'bg-amber-700 hover:bg-amber-800' },
};

// Метка целиком в одну строку; переносится весь ряд меток, а не текст внутри метки.
const BADGE = 'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold';

function ActionButtons({ doc, actions, onAction }: Pick<RequestCardProps, 'doc' | 'actions' | 'onAction'>) {
  if (actions.length === 0) return null;
  return (
    <div className="mt-3 flex gap-2">
      {actions.map((action) => (
        <button
          key={action}
          type="button"
          onClick={() => onAction(action, doc)}
          className={`cursor-pointer min-h-11 flex-1 rounded-lg px-3 text-sm font-semibold text-white shadow-sm transition ${ACTION_BUTTONS[action].className}`}
        >
          {ACTION_BUTTONS[action].label}
        </button>
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
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-[0_4px_12px_rgba(15,23,42,0.08)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.12)] transition-shadow">
      <Link
        href={`/profile/${doc.student_id}`}
        className="self-start break-words text-sm font-semibold text-sky-700 hover:text-sky-900 hover:underline"
      >
        {doc.student_name}
      </Link>
      <p className="text-xs text-slate-600">{studentMeta}</p>

      <div className="mt-2 flex flex-wrap items-center gap-1">
        {variant === 'reviewed' ? (
          <span className={`${BADGE} ${isRejected ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
            {isRejected ? 'Отклонена' : 'Подтверждена'}
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
      <p className="mt-1 text-xs text-slate-600">
        {doc.level_display ? `${doc.level_display} · подана ${uploaded}` : `Подана ${uploaded}`}
      </p>

      {variant === 'reviewed' && isRejected && doc.rejection_reason && (
        <p className="mt-1 line-clamp-2 break-words text-xs text-rose-700">Причина: {doc.rejection_reason}</p>
      )}

      {/* mt-auto: кнопки карточек одного ряда сетки стоят на одной линии. */}
      <div className="mt-auto flex items-center justify-between pt-2">
        {doc.files && doc.files.length > 0 && (
          <span className="text-xs text-slate-600">
            <i className="fa-solid fa-file mr-1" aria-hidden="true" />
            Файлов: {doc.files.length}
          </span>
        )}
        <Link
          href={`/achievement/${doc.id}`}
          className="cursor-pointer ml-auto inline-flex min-h-11 items-center text-xs font-semibold text-sky-700 hover:text-sky-900"
        >
          Подробнее
        </Link>
      </div>

      <ActionButtons doc={doc} actions={actions} onAction={onAction} />
    </div>
  );
}
