'use client';

import RouteErrorFallback from '@/components/RouteErrorFallback';

/** Корневой error boundary приложения (внутри layout — Header жив). */
export default function ErrorPage(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteErrorFallback
      label="App"
      title="Ошибка приложения"
      description="Произошла непредвиденная ошибка. Попробуйте обновить страницу."
      {...props}
    />
  );
}
