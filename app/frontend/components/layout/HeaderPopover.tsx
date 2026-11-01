'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Вход - из @starting-style, выход быстрее входа; allow-discrete держит display и верхний слой до конца выхода.
const MOTION =
  'origin-top -translate-y-1 scale-98 opacity-0 transition-[opacity,translate,scale,display,overlay] transition-discrete duration-100 ease-in ' +
  'open:translate-y-0 open:scale-100 open:opacity-100 open:duration-150 open:ease-out ' +
  'starting:open:-translate-y-1 starting:open:scale-98 starting:open:opacity-0 motion-reduce:transition-none sm:origin-top-right';

/** Панель - под кнопкой: на ПК у её правого края, на телефоне во всю ширину; выше экрана - прокрутка внутри. */
function placeUnder(button: HTMLElement, panel: HTMLElement) {
  const rect = button.getBoundingClientRect();
  const top = rect.bottom + 8;
  const wide = window.matchMedia('(min-width: 40rem)').matches;
  panel.style.top = `${top}px`;
  panel.style.left = wide ? 'auto' : '8px';
  // right у fixed-панели отсчитывается от края без полосы прокрутки - clientWidth, а не innerWidth.
  panel.style.right = `${wide ? document.documentElement.clientWidth - rect.right : 8}px`;
  panel.style.maxHeight = `calc(100dvh - ${top + 8}px)`;
}

// Без Popover API (Safari до 17, Chrome до 114) панель показывает атрибут open, а toggle шлём сами, как браузер.
function setShown(panel: HTMLElement, shown: boolean) {
  if (panel.hasAttribute('open') === shown) return;
  panel.toggleAttribute('open', shown);
  panel.dispatchEvent(Object.assign(new Event('toggle'), { newState: shown ? 'open' : 'closed' }));
}

// Ранние реализации Popover API бросали исключение на hidePopover() у закрытой панели.
function hide(panel: HTMLElement) {
  if (!panel.hasAttribute('popover')) setShown(panel, false);
  else if (panel.hidePopover && panel.matches(':popover-open')) panel.hidePopover();
}

const noSubscribe = () => () => {};
const hasPopoverApi = () => 'showPopover' in HTMLElement.prototype;

/**
 * Кнопка шапки с выпадающей панелью на Popover API: закрытие по Esc и клику мимо и возврат фокуса
 * на кнопку даёт браузер. Панель встаёт под кнопку в момент клика (до открытия) и, пока открыта,
 * идёт за ней. Без Popover API то же даёт запасной вариант: атрибут open, свои Esc и клик мимо.
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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // Сервер рисует панель на Popover API; без API клиент сразу после гидрации перерисует её запасной.
  const native = useSyncExternalStore(noSubscribe, hasPopoverApi, () => true);

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
    if (panelRef.current) hide(panelRef.current);
  }, [pathname]);

  // Незакреплённая шапка (крупный шрифт) уезжает при прокрутке, поворот экрана меняет раскладку;
  // без Popover API Esc и клик мимо обрабатываем сами.
  useEffect(() => {
    const button = buttonRef.current;
    const panel = panelRef.current;
    if (!open || !button || !panel) return;
    const follow = () => placeUnder(button, panel);
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panel.contains(target) && !button.contains(target)) setShown(panel, false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setShown(panel, false);
      button.focus();
    };
    window.addEventListener('scroll', follow, { passive: true });
    window.addEventListener('resize', follow);
    if (!native) {
      document.addEventListener('pointerdown', onPointerDown);
      document.addEventListener('keydown', onKeyDown);
    }
    return () => {
      window.removeEventListener('scroll', follow);
      window.removeEventListener('resize', follow);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, native]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        popoverTarget={native ? id : undefined}
        aria-controls={id}
        aria-expanded={open}
        aria-label={label}
        onClick={(event) => {
          const panel = panelRef.current;
          if (!panel) return;
          placeUnder(event.currentTarget, panel);
          if (!native) setShown(panel, !panel.hasAttribute('open'));
        }}
        className={buttonClassName}
      >
        {button}
      </button>
      {/* Ссылка на тот же путь (Кабинет из ?tab=…) или на ЭОС путь не меняет - закрываем по клику. */}
      <div
        ref={panelRef}
        id={id}
        popover={native ? 'auto' : undefined}
        data-popover-fallback={native ? undefined : ''}
        role="group"
        aria-label={label}
        onClick={(event) => {
          if ((event.target as Element).closest('a')) hide(event.currentTarget);
        }}
        // Tab увёл фокус дальше по странице - открытая панель не должна его закрывать.
        onBlur={(event) => {
          const to = event.relatedTarget;
          if (to && to !== buttonRef.current && !event.currentTarget.contains(to)) hide(event.currentTarget);
        }}
        className={`inset-auto m-0 w-auto overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 text-slate-900 shadow-lg ${native ? '' : 'fixed z-40 [&:not([open])]:hidden'} ${MOTION} ${panelClassName}`}
      >
        {children}
      </div>
    </>
  );
}
