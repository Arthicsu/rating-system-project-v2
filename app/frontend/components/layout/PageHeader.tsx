import type { ReactNode } from 'react';

/** Размер заголовка страницы; этим же классом оформлены h1 внутри карточек (вход, профиль, заявка). */
export const PAGE_TITLE = 'text-xl font-semibold text-slate-900 sm:text-2xl';

/** Шапка страницы: h1, пояснение под ним и действия справа (на узком экране — под заголовком). */
export default function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <div className="min-w-0 flex-1">
        <h1 className={PAGE_TITLE}>{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
