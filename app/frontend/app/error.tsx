'use client';

import { useEffect } from 'react';
import ErrorState from '@/components/ErrorState';

type ErrorPageProps = {
  error: Error & { digest?: string; statusCode?: number };
  reset: () => void;
};

export default function ErrorPage({ error }: ErrorPageProps) {
  // useEffect(() => {
  //   const statusCode = (error as Error & { statusCode?: number }).statusCode || 500;
  //   if (!window.location.pathname.startsWith('/error/')) {
  //     window.location.href = `/error/${statusCode}?msg=${encodeURIComponent(error.message)}`;
  //   }
  // }, [error]);

  return (
    <main className="px-5 pt-25">
      <ErrorState
        code={500}
        title="Внутренняя ошибка"
        description="Произошла непредвиденная ошибка. Повторите запрос позже."
      />
    </main>
  );
}
