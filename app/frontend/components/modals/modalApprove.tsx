'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import type { ModalApproveProps } from '@/interfaces/ModalInterfaces'

export default function ModalApprove({ isOpen, targetScore, onClose, onConfirm }: ModalApproveProps) {
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

  return (
    <div
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
      </div>
    </div>
  );
}
