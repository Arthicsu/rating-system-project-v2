'use client';
import ModalShell from '@/components/modals/ModalShell';
import type { ModalRejectProps } from '@/interfaces/ModalInterfaces'

/**
 * Отклонение (студенту на исправление) или возврат кафедре: готовые причины и свой
 * комментарий указываются вместе; без единой причины отправить нельзя.
 */
export default function ModalReject({
  isOpen,
  action,
  targetScore,
  debitsScore,
  saving,
  rejectionReasons,
  selectedReasons,
  customReason,
  onToggleReason,
  onCustomReasonChange,
  onClose,
  onSubmit,
}: ModalRejectProps) {
  const isReturn = action === 'return';
  const score = <b className="font-semibold text-slate-900">{targetScore}</b>;
  const hasReason = selectedReasons.length > 0 || customReason.trim() !== '';

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      locked={saving}
      closeButton
      id="modal-reject"
      labelledBy="modal-reject-title"
      overlayClassName="z-40 items-center justify-center px-4 py-6 sm:px-0"
      panelClassName="relative max-h-full w-full max-w-md overflow-y-auto rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.35)] sm:p-6"
    >
      {(close) => (
        <>
          <h2 id="modal-reject-title" className="mb-2 pr-8 text-base font-semibold text-slate-900">
            {isReturn ? 'Вернуть заявку кафедре?' : 'Отклонить заявку?'}
          </h2>
          {/* Последствия решения - до выбора причин, чтобы не было сюрпризов с баллами. */}
          <p className="mb-3 text-sm text-slate-700">
            {debitsScore && <>Будет списано {score} балл(-ов). </>}
            {isReturn
              ? 'Заявка вернётся кафедре на повторное рассмотрение.'
              : 'Заявка уйдёт студенту на исправление, он увидит причину.'}
          </p>
          <form className="space-y-3" onSubmit={onSubmit}>
            <fieldset className="space-y-2.5">
              <legend className="mb-2 text-sm text-slate-600">
                Отметьте готовые причины и (или) напишите комментарий.
              </legend>
              {rejectionReasons.map((reason) => (
                <label
                  key={reason.id}
                  className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 transition hover:border-sky-400 hover:bg-sky-50"
                >
                  <span className="pr-2">{reason.text}</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    onChange={() => onToggleReason(reason.id)}
                    checked={selectedReasons.includes(reason.id)}
                  />
                </label>
              ))}
            </fieldset>

            <div>
              <label htmlFor="review-comment" className="mb-1 block text-sm font-medium text-slate-800">
                {isReturn ? 'Комментарий кафедре' : 'Комментарий студенту'}
              </label>
              <div className="relative">
                <textarea
                  id="review-comment"
                  className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 pb-5 text-base text-slate-900 shadow-sm outline-none ring-sky-600/0 transition placeholder:text-slate-500 focus:border-sky-600 focus:bg-white focus:ring-2 focus:ring-sky-600 sm:text-sm"
                  rows={3}
                  maxLength={500}
                  placeholder={isReturn ? 'Что кафедре проверить ещё раз' : 'Что студенту исправить'}
                  value={customReason}
                  onChange={(e) => onCustomReasonChange(e.target.value)}
                />
                <span className="absolute bottom-1.5 right-2 text-xs text-slate-500" aria-hidden="true">
                  {customReason.length}/500
                </span>
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="submit"
                disabled={saving || !hasReason}
                className={`cursor-pointer inline-flex min-h-11 flex-1 items-center justify-center rounded-full px-4 text-sm font-semibold text-white shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60 ${
                  isReturn
                    ? 'bg-amber-700 hover:bg-amber-800 focus:ring-amber-700'
                    : 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-600'
                }`}
              >
                {saving ? 'Сохраняем…' : isReturn ? 'Вернуть' : 'Отклонить'}
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
          </form>
        </>
      )}
    </ModalShell>
  );
}
