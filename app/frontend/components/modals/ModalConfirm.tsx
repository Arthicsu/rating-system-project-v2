'use client';
import Button from '@/components/Button';
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

          <div className="flex gap-2 low-vision:flex-col">
            <Button variant={danger ? 'danger' : 'primary'} disabled={loading} onClick={onConfirm} className="flex-1">
              {loading ? 'Подождите…' : confirmLabel}
            </Button>
            <Button variant="secondary" disabled={loading} onClick={close} className="flex-1">
              {cancelLabel}
            </Button>
          </div>
        </>
      )}
    </ModalShell>
  );
}
