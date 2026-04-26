'use client';

import { useEffect } from 'react';
import ErrorState from '@/components/ErrorState';

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error('React error boundary triggered:', error);
  }, [error]);

  return (
    <main className="px-5 pt-25">
      <ErrorState
        code={500}
        title="Ошибка приложения"
        description="Произошла непредвиденная ошибка. Попробуйте обновить страницу."
        message={error.message}
        onReset={reset}
      />
    </main>
  );
}