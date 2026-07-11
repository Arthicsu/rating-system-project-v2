'use client';

import { useEffect } from 'react';
import ErrorState from '@/components/ErrorState';

/** Крэш рендера в профиле студента: остаёмся в приложении, даём retry. */
export default function ProfileError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Profile error boundary:', error);
  }, [error]);

  return (
    <main className="px-5 pt-25">
      <ErrorState
        code={500}
        title="Не удалось отобразить профиль"
        description="Произошла непредвиденная ошибка. Попробуйте ещё раз."
        onReset={reset}
      />
    </main>
  );
}
