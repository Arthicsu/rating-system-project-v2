'use client';

import { useEffect } from 'react';
import ErrorState from '@/components/ErrorState';

interface RouteErrorFallbackProps {
  /** Метка сегмента для console.error (например "Profile"). */
  label: string;
  title: string;
  error: Error & { digest?: string };
  reset: () => void;
  description?: string;
}

/**
 * Общее тело для route-level error.tsx: лог в консоль + ErrorState с retry.
 * Сами файлы error.tsx обязаны существовать по одному на сегмент (контракт
 * App Router), поэтому они остаются тонкими обёртками над этим компонентом.
 */
export default function RouteErrorFallback({
  label,
  title,
  error,
  reset,
  description = 'Произошла непредвиденная ошибка. Попробуйте ещё раз.',
}: RouteErrorFallbackProps) {
  useEffect(() => {
    console.error(`${label} error boundary:`, error);
  }, [label, error]);

  return (
    <main className="px-5 pt-25">
      <ErrorState code={500} title={title} description={description} onReset={reset} />
    </main>
  );
}
