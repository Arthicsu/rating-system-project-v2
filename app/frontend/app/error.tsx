'use client';

import ErrorState from '@/components/ErrorState';

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error }: ErrorPageProps) {
  console.error(error);

  return (
    <main className="px-5 pt-25">
      <ErrorState
        code={500}
        title="Внутренняя ошибка сервера"
        description="Произошла непредвиденная ошибка. Попробуйте повторить действие."
      />
    </main>
  );
}
