'use client';
import ModalShell from './ModalShell';
import type { ModalConfirmProps } from '@/interfaces/ModalInterfaces';

export default function ModalConfirm({
  isOpen,
  title,
  message,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  danger = false,
  loading = false,
  onConfirm,
  onClose,
}: ModalConfirmProps) {
  const confirmClasses = danger
    ? 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-500'
    : 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500';

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      locked={loading}
      panelClassName="relative w-full max-w-sm rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.35)] sm:p-6"
    >
      {(close) => (
        <>
          <h2 className="mb-2 text-base font-semibold text-slate-900">{title}</h2>
          <p className="mb-5 text-sm text-slate-600">{message}</p>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={onConfirm}
              className={`cursor-pointer inline-flex flex-1 items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60 ${confirmClasses}`}
            >
              {loading ? 'Подождите…' : confirmLabel}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={close}
              className="cursor-pointer inline-flex flex-1 items-center justify-center rounded-full bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {cancelLabel}
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}
