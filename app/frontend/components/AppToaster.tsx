'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { Toaster } from 'react-hot-toast';
import toast from '@/lib/toast';

const WIDE = '(min-width: 40rem)';
const subscribe = (onChange: () => void) => {
  const query = window.matchMedia(WIDE);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};

/**
 * Уведомления: на ПК - справа сверху под шапкой, на телефоне - снизу над нижней панелью
 * (--toast-bottom в globals.css учитывает её и крупный текст).
 * Здесь же - уведомления о потере и возврате сети.
 */
export default function AppToaster() {
  const wide = useSyncExternalStore(subscribe, () => window.matchMedia(WIDE).matches, () => true);

  useEffect(() => {
    const offline = () =>
      toast.error('Нет соединения с интернетом. Изменения не сохранятся, пока сеть не вернётся.', {
        id: 'network',
        duration: Infinity,
      });
    const online = () => toast.success('Соединение восстановлено', { id: 'network' });
    window.addEventListener('offline', offline);
    window.addEventListener('online', online);
    return () => {
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', online);
    };
  }, []);

  return (
    <Toaster
      position={wide ? 'top-right' : 'bottom-center'}
      containerStyle={wide ? { top: '4.75rem' } : { bottom: 'var(--toast-bottom)' }}
      toastOptions={{
        // --surface задана только в тёмной теме; в светлой уведомление белое.
        style: {
          background: 'var(--surface, #fff)',
          color: 'var(--color-slate-900)',
          border: '1px solid var(--color-slate-200)',
        },
      }}
    />
  );
}
