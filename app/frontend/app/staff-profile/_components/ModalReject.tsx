'use client';
import ModalShell from '@/components/modals/ModalShell';
import type { ModalRejectProps } from '@/interfaces/ModalInterfaces'

export default function ModalReject({
  isOpen,
  action,
  targetScore,
  debitsScore,
  rejectionReasons,
  selectedReasons,
  customReason,
  onToggleReason,
  onCustomReasonChange,
  onClose,
  onSubmit,
}: ModalRejectProps) {
  const handleCheckboxChange = (reasonId: number) => {
    onToggleReason(reasonId);
    if (!selectedReasons.includes(reasonId)) {
      onCustomReasonChange('');
    }
  };

  const handleCustomReasonChange = (value: string) => {
    onCustomReasonChange(value);
    if (value.trim() !== '' && selectedReasons.length > 0) {
      selectedReasons.forEach(id => onToggleReason(id));
    }
  };

  const isReturn = action === 'return';
  const score = <b className="font-semibold text-slate-900">{targetScore}</b>;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      closeButton
      id="modal-reject"
      overlayClassName="z-40 items-center justify-center px-4 py-6 sm:px-0"
    >
      {(close) => (
        <>
          <h2 className="mb-2 text-base font-semibold text-slate-900">
            {isReturn ? 'Вернуть заявку кафедре?' : 'Отклонить заявку?'}
          </h2>
          {/* Последствия решения - до выбора причин, чтобы не было сюрпризов с баллами. */}
          <p className="mb-3 text-sm text-slate-700">
            {debitsScore && <>Будет списано {score} балл(-ов). </>}
            {isReturn
              ? 'Заявка вернётся кафедре на повторное рассмотрение.'
              : 'Заявка уйдёт студенту на исправление, он увидит причину.'}
          </p>
          <p className="mt-1 mb-2 text-base text-slate-500">
            Выберите причину(-ы) из представленных ниже или напишите собственную.
          </p>
          <form className="space-y-3" onSubmit={onSubmit}>
            <div className="space-y-2.5">
              {rejectionReasons.map((reason) => (
                <label
                  key={reason.id}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 transition hover:border-sky-400 hover:bg-sky-50 sm:text-sm"
                >
                  <span className="pr-2">{reason.text}</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    onChange={() => handleCheckboxChange(reason.id)}
                    checked={selectedReasons.includes(reason.id)}
                  />
                </label>
              ))}
            </div>

            <div className="relative">
              <textarea
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none ring-sky-600/0 transition placeholder:text-slate-400 focus:border-sky-600 focus:bg-white focus:ring-2 focus:ring-sky-600 resize-none"
                rows={3}
                maxLength={500}
                placeholder="Или напишите свою причину"
                value={customReason}
                onChange={(e) => handleCustomReasonChange(e.target.value)}
              />
              <span className="absolute bottom-1.5 right-2 text-[10px] text-slate-400">
                {customReason.length}/500
              </span>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="submit"
                className={`cursor-pointer inline-flex flex-1 items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                  isReturn
                    ? 'bg-amber-700 hover:bg-amber-800 focus:ring-amber-700'
                    : 'bg-rose-500 hover:bg-rose-600 focus:ring-rose-500'
                }`}
              >
                {isReturn ? 'Вернуть' : 'Отклонить'}
              </button>
              <button
                type="button"
                className="cursor-pointer inline-flex flex-1 items-center justify-center rounded-full bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1"
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
