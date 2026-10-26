'use client';
import ModalShell from '@/components/modals/ModalShell';
import type { ModalApproveProps } from '@/interfaces/ModalInterfaces'

/**
 * Подтверждение одобрения: видно, что именно одобряется. Фокус сразу на «Одобрить» -
 * решение принимается кликом или Enter; на время сохранения окно не закрывается.
 */
export default function ModalApprove({ isOpen, doc, saving, onClose, onConfirm }: ModalApproveProps) {
  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      locked={saving}
      closeButton
      labelledBy="modal-approve-title"
      overlayClassName="z-40 items-center justify-center px-4 py-6 sm:px-0"
    >
      {(close) => (
        <>
          <h2 id="modal-approve-title" className="mb-3 pr-8 text-base font-semibold text-slate-900">
            Одобрить заявку?
          </h2>
          {doc && (
            <dl className="mb-3 space-y-2 rounded-xl bg-slate-50 p-3 text-sm">
              <div>
                <dt className="text-xs text-slate-600">Студент</dt>
                <dd className="break-words font-medium text-slate-900">{doc.student_name}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-600">Достижение</dt>
                <dd className="line-clamp-3 break-words text-slate-900">{doc.achievement}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-600">Категория</dt>
                <dd className="text-slate-900">{doc.category_display}</dd>
              </div>
            </dl>
          )}
          <p className="text-sm text-slate-700">
            Будет начислено <b className="font-semibold text-slate-900">{doc?.score ?? 0}</b> балл(-ов).
          </p>
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              autoFocus
              disabled={saving}
              className="cursor-pointer inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={onConfirm}
            >
              {saving ? 'Сохраняем…' : 'Одобрить'}
            </button>
            <button
              type="button"
              disabled={saving}
              className="cursor-pointer inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-slate-200 px-4 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={close}
            >
              Отмена
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}
