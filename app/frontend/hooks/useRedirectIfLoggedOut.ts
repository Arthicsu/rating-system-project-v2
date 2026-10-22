'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

import { useMySession } from '@/context/AuthContext';

/**
 * Guard приватной страницы: без сессии - на вход.
 *
 * proxy.ts пускает на приватные страницы только с кукой sessionid, поэтому если
 * сессии нет с самого начала - она погасла (пароль сменили на другом устройстве,
 * сессии сброшены): вход с плашкой «Сессия истекла» и возвратом на страницу.
 * Если пользователь был и пропал - это обычный «Выйти», чистый /login. Если сервер
 * не ответил на проверку сессии - вход без плашки: утверждать «истекла» нельзя.
 */
export function useRedirectIfLoggedOut(path: string) {
  const { user, loading, sessionCheckFailed } = useMySession();
  const router = useRouter();
  const hadUser = useRef(false);

  useEffect(() => {
    if (user) {
      hadUser.current = true;
      return;
    }
    if (loading) return;
    if (hadUser.current) {
      router.replace('/login');
      return;
    }
    const next = `/login?next=${encodeURIComponent(path)}`;
    router.replace(sessionCheckFailed ? next : `${next}&expired=1`);
  }, [user, loading, sessionCheckFailed, path, router]);
}
