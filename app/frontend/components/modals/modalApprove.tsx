import Image from 'next/image';
import type { ModalApproveProps } from '@/interfaces/ModalInterfaces'

export default function ModalApprove({ isOpen, targetScore, onClose, onConfirm }: ModalApproveProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 px-4 py-6 sm:px-0"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-md rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.35)] sm:p-6">
        <button
          type="button"
          className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full text-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          onClick={onClose}
        >
          &times;
        </button>
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
            className="inline-flex w-full items-center justify-center rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
            onClick={onConfirm}
          >
            Подтвердить
          </button>
        </div>
        <div className="mt-6 flex justify-center">
          <Image
            src="/media/logo_BGITU.png"
            alt="БГИТУ"
            width={32}
            height={32}
            className="h-8 w-auto opacity-80"
          />
        </div>
      </div>
    </div>
  );
}