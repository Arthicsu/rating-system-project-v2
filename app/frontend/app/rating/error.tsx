'use client';

import { useEffect } from 'react';
import ErrorState from '@/components/ErrorState';

/** Крэш рендера на странице рейтинга: остаёмся в приложении, даём retry. */
export default function RatingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Rating error boundary:', error);
  }, [error]);

  return (
    <main className="px-5 pt-25">
      <ErrorState
        code={500}
        title="Не удалось отобразить рейтинг"
        description="Произошла непредвиденная ошибка. Попробуйте ещё раз."
        onReset={reset}
      />
    </main>
  );
}
