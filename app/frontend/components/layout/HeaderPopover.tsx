'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Вход - из @starting-style, выход быстрее входа; allow-discrete держит display и верхний слой до конца выхода.
const MOTION =
  'origin-top -translate-y-1 scale-98 opacity-0 transition-[opacity,translate,scale,display,overlay] transition-discrete duration-100 ease-in ' +
  'open:translate-y-0 open:scale-100 open:opacity-100 open:duration-150 open:ease-out ' +
  'starting:open:-translate-y-1 starting:open:scale-98 starting:open:opacity-0 motion-reduce:transition-none sm:origin-top-right';

/**
 * Кнопка шапки с выпадающей панелью на Popover API: закрытие по Esc и клику мимо и возврат фокуса
 * на кнопку даёт браузер. Панель встаёт под кнопку в момент клика (до открытия): на ПК - у её
 * правого края, на телефоне - во всю ширину; выше экрана - прокрутка внутри.
 */
export default function HeaderPopover({
  id,
  label,
  button,
  buttonClassName,
  panelClassName = '',
  children,
}: {
  id: string;
  label: string;
  button: React.ReactNode;
  buttonClassName: string;
  panelClassName?: string;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const onToggle = (event: Event) => {
      const isOpen = (event as ToggleEvent).newState === 'open';
      setOpen(isOpen);
      if (isOpen) panel.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    };
    panel.addEventListener('toggle', onToggle);
    return () => panel.removeEventListener('toggle', onToggle);
  }, []);

  useEffect(() => {
    panelRef.current?.hidePopover();
  }, [pathname]);

  const place = (event: React.MouseEvent<HTMLButtonElement>) => {
    const panel = panelRef.current;
    if (!panel) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const top = rect.bottom + 8;
    const wide = window.matchMedia('(min-width: 40rem)').matches;
    panel.style.top = `${top}px`;
    panel.style.left = wide ? 'auto' : '8px';
    // right у fixed-панели отсчитывается от края без полосы прокрутки - clientWidth, а не innerWidth.
    panel.style.right = `${wide ? document.documentElement.clientWidth - rect.right : 8}px`;
    panel.style.maxHeight = `calc(100dvh - ${top + 8}px)`;
  };

  return (
    <>
      <button
        type="button"
        popoverTarget={id}
        aria-controls={id}
        aria-expanded={open}
        aria-label={label}
        onClick={place}
        className={buttonClassName}
      >
        {button}
      </button>
      {/* Ссылка на тот же путь (Кабинет из ?tab=…) или на ЭОС путь не меняет - закрываем по клику. */}
      <div
        ref={panelRef}
        id={id}
        popover="auto"
        role="group"
        aria-label={label}
        onClick={(event) => {
          if ((event.target as Element).closest('a')) event.currentTarget.hidePopover();
        }}
        className={`inset-auto m-0 w-auto overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 text-slate-900 shadow-lg ${MOTION} ${panelClassName}`}
      >
        {children}
      </div>
    </>
  );
}
