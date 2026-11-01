'use client';

interface StateFilterProps {
  /** Подпись группы для скринридера. */
  label: string;
  /** count - сколько заявок покажет таблетка; disabled - выбрать нечего. */
  options: { value: string; label: string; count?: number; disabled?: boolean }[];
  value: string;
  onChange: (value: string) => void;
}

/**
 * Переключатель-«таблетки» состояния заявок; значение 'all' - без фильтра.
 * Кнопки с aria-pressed, а не radiogroup: тому нужна навигация стрелками, а здесь
 * достаточно Tab. Таблетки переносятся на новую строку, а не обрезаются.
 */
export default function StateFilter({ label, options, value, onChange }: StateFilterProps) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={`cursor-pointer inline-flex min-h-11 items-center rounded-full border px-3 text-xs font-medium transition motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-9 sm:text-sm ${
              active
                ? 'border-sky-700 bg-sky-700 text-white'
                : 'border-slate-200 bg-white text-slate-700 enabled:hover:bg-slate-50'
            }`}
          >
            {option.label}
            {option.count !== undefined && (
              <span className={`ml-1.5 tabular-nums ${active ? 'text-white' : 'text-slate-500'}`}>{option.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
