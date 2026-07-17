'use client';

interface MobileFilterToggleProps {
  onClick: () => void;
  /** Tailwind-класс видимости, задаёт брейкпоинт (например "max-[411px]:flex"). */
  visibleAt: string;
}

/** Кнопка-гамбургер, раскрывающая панель фильтров на узких экранах. */
export default function MobileFilterToggle({ onClick, visibleAt }: MobileFilterToggleProps) {
  return (
    <div className={`mb-2 hidden ${visibleAt} items-center`}>
      <button
        type="button"
        aria-label="Фильтры"
        onClick={onClick}
        className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-700 shadow-sm active:scale-95 transition"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          className="h-4 w-4"
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
      </button>
    </div>
  );
}
