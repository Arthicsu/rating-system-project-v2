'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

type State = 'idle' | 'loading' | 'done';

/**
 * Полоса загрузки вверху окна при переходе между страницами. Событий роутера у App Router нет:
 * старт - клик по внутренней ссылке (в фазе перехвата: Link сам отменяет действие ссылки), конец -
 * смена адреса. «Назад» и «Вперёд» Next отдаёт из своего кэша сразу - им полоса не нужна.
 * Полоса видна только после 150 мс загрузки.
 */
export default function NavigationProgress() {
  const url = `${usePathname()}?${useSearchParams().toString()}`;
  const [state, setState] = useState<State>('idle');
  const [seenUrl, setSeenUrl] = useState(url);
  if (url !== seenUrl) {
    setSeenUrl(url);
    if (state === 'loading') setState('done');
  }

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.('a[href]');
      if (!(link instanceof HTMLAnchorElement) || (link.target && link.target !== '_self') || link.hasAttribute('download')) return;
      const next = new URL(link.href, window.location.href);
      if (next.origin !== window.location.origin) return;
      if (next.pathname === window.location.pathname && next.search === window.location.search) return;
      setState('loading');
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  // Выход полосы и страховка: переход, который так и не сменил адрес, не держит её вечно.
  useEffect(() => {
    if (state === 'idle') return;
    const timer = window.setTimeout(() => setState(state === 'done' ? 'idle' : 'done'), state === 'done' ? 300 : 10000);
    return () => window.clearTimeout(timer);
  }, [state]);

  return <div aria-hidden="true" data-state={state} className="nav-progress" />;
}
