'use client';

import RouteErrorFallback from '@/components/RouteErrorFallback';

/** Крэш рендера внутри staff-профиля: остаёмся в приложении (Header жив), даём retry. */
export default function StaffProfileError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteErrorFallback label="Staff-profile" title="Не удалось отобразить кабинет сотрудника" {...props} />;
}
