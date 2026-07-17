'use client';

import RouteErrorFallback from '@/components/RouteErrorFallback';

/** Крэш рендера на странице рейтинга: остаёмся в приложении, даём retry. */
export default function RatingError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteErrorFallback label="Rating" title="Не удалось отобразить рейтинг" {...props} />;
}
