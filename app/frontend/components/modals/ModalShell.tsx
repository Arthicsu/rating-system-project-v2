'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  /** Пока true — модалка не закрывается никаким способом (идёт сохранение). */
  locked?: boolean;
  /** Вызывается после анимации закрытия — для сброса локального состояния модалки. */
  onClosed?: () => void;
  /** Закрывать ли кликом мимо панели; Esc закрывает всегда. */
  closeOnBackdrop?: boolean;
  /** Стандартный крестик в правом верхнем углу панели. */
  closeButton?: boolean;
  id?: string;
  /** z-index и выравнивание панели внутри бекдропа. */
  overlayClassName?: string;
  /** Панель: ширина, скругление, фон; анимацию добавляет каркас. */
  panelClassName?: string;
  /** Контент получает close с анимацией — для кнопок «Отмена» и submit-обработчиков. */
  children: (close: () => void) => React.ReactNode;
}

/**
 * Общий каркас модалок: fade-автомат открытия/закрытия (rAF + таймер 200мс),
 * бекдроп, Esc и блокировка прокрутки фона. Раньше этот автомат был скопирован
 * в каждой модалке по отдельности.
 */
export default function ModalShell({
  isOpen,
  onClose,
  locked = false,
  onClosed,
  closeOnBackdrop = true,
  closeButton = false,
  id,
  overlayClassName = 'z-50 items-center justify-center px-4 py-6 sm:px-0',
  panelClassName = 'relative w-full max-w-md rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.35)] sm:p-6',
  children,
}: ModalShellProps) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  // Актуальные колбэки в ref (как onSearchRef в SearchInput): родители передают
  // их инлайн-функциями, и новая ссылка не должна перезапускать таймер закрытия.
  const callbacksRef = useRef({ onClose, onClosed });
  useEffect(() => {
    callbacksRef.current = { onClose, onClosed };
  });

  useEffect(() => {
    if (isOpen && !closing) {
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
  }, [isOpen, closing]);

  // Анимация закрытия: 200мс на fade-out, затем уведомляем родителя.
  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(() => {
      const { onClose, onClosed } = callbacksRef.current;
      onClose();
      setClosing(false);
      onClosed?.();
    }, 200);
    return () => clearTimeout(timer);
  }, [closing]);

  const handleClose = useCallback(() => {
    if (locked) return;
    setVisible(false);
    setClosing(true);
  }, [locked]);

  // Esc + блокировка прокрутки фона, пока модалка открыта.
  useEffect(() => {
    if (!isOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, handleClose]);

  if (!isOpen && !closing) return null;

  return (
    <div
      id={id}
      className={`fixed inset-0 flex transition-all duration-200 ${overlayClassName} ${
        visible ? 'bg-slate-900/60' : 'bg-slate-900/0 pointer-events-none'
      }`}
      onClick={closeOnBackdrop ? (e) => { if (e.target === e.currentTarget) handleClose(); } : undefined}
    >
      <div className={`transform transition-all duration-200 ${panelClassName} ${
        visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
      }`}>
        {closeButton && (
          <button
            type="button"
            aria-label="Закрыть"
            className="cursor-pointer absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full text-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            onClick={handleClose}
          >
            &times;
          </button>
        )}
        {children(handleClose)}
      </div>
    </div>
  );
}
