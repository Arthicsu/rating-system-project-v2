'use client';

import RouteErrorFallback from '@/components/RouteErrorFallback';

/** Крэш рендера в профиле студента: остаёмся в приложении, даём retry. */
export default function ProfileError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteErrorFallback label="Profile" title="Не удалось отобразить профиль" {...props} />;
}
