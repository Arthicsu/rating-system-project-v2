'use client';

import { useEffect } from 'react';
import ErrorState from '@/components/ErrorState';

/** Крэш рендера внутри staff-профиля: остаёмся в приложении (Header жив), даём retry. */
export default function StaffProfileError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Staff-profile error boundary:', error);
  }, [error]);

  return (
    <main className="px-5 pt-25">
      <ErrorState
        code={500}
        title="Не удалось отобразить кабинет сотрудника"
        description="Произошла непредвиденная ошибка. Попробуйте ещё раз."
        onReset={reset}
      />
    </main>
  );
}
