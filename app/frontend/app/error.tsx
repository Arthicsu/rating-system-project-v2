'use client';

import ErrorState from '@/components/ErrorState';

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  console.error(error);

  return (
    <main className="px-5 pt-25">
      <ErrorState
        code={500}
        title="Внутренняя ошибка сервера"
        description="Произошла непредвиденная ошибка. Попробуйте повторить действие."
      />
      <div className="mx-auto -mt-8 flex w-full max-w-2xl justify-center pb-8">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          Попробовать снова
        </button>
      </div>
    </main>
  );
}
