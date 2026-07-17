'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import type { ModalRejectProps } from '@/interfaces/ModalInterfaces'

export default function ModalReject({
  isOpen,
  rejectionReasons,
  selectedReasons,
  customReason,
  onToggleReason,
  onCustomReasonChange,
  onClose,
  onSubmit,
}: ModalRejectProps) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen && !closing) {
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
  }, [isOpen, closing]);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const handleClose = useCallback(() => {
    setVisible(false);
    setClosing(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onClose();
      setClosing(false);
    }, 200);
  }, [onClose]);

  if (!isOpen && !closing) return null;

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

  return (
    <div
      id="modal-reject"
      className={`fixed inset-0 z-40 flex items-center justify-center px-4 py-6 sm:px-0 transition-all duration-200 ${
        visible ? 'bg-slate-900/60' : 'bg-slate-900/0 pointer-events-none'
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className={`relative w-full max-w-md rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.35)] sm:p-6 transform transition-all duration-200 ${
        visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
      }`}>
        <button
          type="button"
          className="cursor-pointer absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full text-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          onClick={handleClose}
        >
          &times;
        </button>
        <h2 className="mb-3 text-base font-semibold text-slate-900">
          Укажите причину отказа
        </h2>
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
              className="cursor-pointer inline-flex flex-1 items-center justify-center rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-1"
            >
              Отправить
            </button>
            <button
              type="button"
              className="cursor-pointer inline-flex flex-1 items-center justify-center rounded-full bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1"
              onClick={handleClose}
            >
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
