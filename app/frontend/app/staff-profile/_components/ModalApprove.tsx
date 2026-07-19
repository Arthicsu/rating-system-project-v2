'use client';
import ModalShell from '@/components/modals/ModalShell';
import type { ModalApproveProps } from '@/interfaces/ModalInterfaces'

export default function ModalApprove({ isOpen, targetScore, onClose, onConfirm }: ModalApproveProps) {
  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      closeButton
      overlayClassName="z-40 items-center justify-center px-4 py-6 sm:px-0"
    >
      {() => (
        <>
          <h2 className="mb-2.5 text-base font-semibold text-slate-900">
            Подтвердить достижение?
          </h2>
          <p className="text-sm text-slate-500">
            Студенту будет начислено{' '}
            <b className="font-semibold text-slate-900">
              {targetScore}
            </b>{' '}
            балл(-ов).
          </p>
          <div className="mt-5">
            <button
              type="button"
              className="cursor-pointer inline-flex w-full items-center justify-center rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
              onClick={onConfirm}
            >
              Подтвердить
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}
