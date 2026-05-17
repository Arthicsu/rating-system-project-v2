import type { ModalRejectProps } from '@/interfaces/ModalInterfaces'

export default function ModalReject({
  isOpen,
  rejectionReasons,
  selectedReasons,
  onToggleReason,
  onClose,
  onSubmit,
}: ModalRejectProps) {
  if (!isOpen) return null;

  return (
    <div
      id="modal-reject"
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 px-4 py-6 sm:px-0"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.35)] sm:p-6">
        <h2 className="mb-3 text-base font-semibold text-slate-900">
          Укажите причину отказа
        </h2>
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
                  onChange={() => onToggleReason(reason.id)}
                  checked={selectedReasons.includes(reason.id)}
                />
              </label>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              className="cursor-pointer inline-flex flex-1 items-center justify-center rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-1"
            >
              Отправить
            </button>
            <button
              type="button"
              className="cursor-pointer inline-flex flex-1 items-center justify-center rounded-full bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1"
              onClick={onClose}
            >
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}