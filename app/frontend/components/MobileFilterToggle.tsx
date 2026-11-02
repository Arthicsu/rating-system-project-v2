'use client';

import { buttonClass } from '@/components/Button';

interface MobileFilterToggleProps {
  onClick: () => void;
  /** Раскрыта ли панель (aria-expanded) и её id (aria-controls). */
  expanded: boolean;
  controls: string;
  /** Tailwind-класс видимости, задаёт брейкпоинт (например "max-[411px]:flex"). */
  visibleAt: string;
}

/** Кнопка «Фильтры», раскрывающая панель фильтров на узких экранах. */
export default function MobileFilterToggle({ onClick, expanded, controls, visibleAt }: MobileFilterToggleProps) {
  return (
    <div className={`hidden ${visibleAt} items-center`}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={controls}
        onClick={onClick}
        className={buttonClass('secondary')}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          className="h-4 w-4"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
        Фильтры
      </button>
    </div>
  );
}
