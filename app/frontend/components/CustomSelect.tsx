'use client';

export interface CustomSelectOption {
  value: string;
  label: string;
}

export interface CustomSelectProps {
  id: string;
  label?: string;
  value: string;
  options: CustomSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  /** Текст ошибки под полем; поле помечается aria-invalid и связывается с текстом. */
  error?: string;
  /** sm — компактные фильтры, md — поля форм. На телефоне оба 44 px и 16 px. */
  size?: 'sm' | 'md';
  onChange: (value: string) => void;
  className?: string;
}

// Без transition фона и рамки: она давала «моргание» при открытии списка на 144 Гц (спек 4е).
const BASE =
  'app-select block w-full cursor-pointer appearance-none truncate rounded-lg border bg-white pl-3 pr-9 text-slate-900 shadow-sm outline-none ' +
  'hover:border-sky-600 focus-visible:border-sky-700 focus-visible:ring-2 focus-visible:ring-sky-700/30 ' +
  'disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500';
// 16 px на телефоне — iOS не увеличивает страницу при фокусе.
const SIZES = {
  sm: 'min-h-11 text-base sm:min-h-9 sm:py-1.5 sm:text-sm',
  md: 'min-h-11 text-base sm:min-h-10 sm:py-2 sm:text-sm',
};

/**
 * Единый выпадающий список на нативном <select>: клавиатура, скринридеры и системные пикеры на
 * телефонах из коробки; свой шеврон, рамка и фокус-кольцо бренда, состояния disabled/error.
 */
export default function CustomSelect({
  id,
  label,
  value,
  options,
  placeholder = 'Выберите значение',
  disabled = false,
  error,
  size = 'md',
  onChange,
  className = '',
}: CustomSelectProps) {
  // Значение вне списка (например, семестры ещё не загрузились) — показываем placeholder.
  const hasValue = options.some((option) => option.value === value);
  const errorId = `${id}-error`;

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-slate-600">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={id}
          value={hasValue ? value : ''}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => onChange(e.target.value)}
          className={`${BASE} ${SIZES[size]} ${error ? 'border-rose-600' : 'border-slate-300'} ${hasValue ? '' : 'text-slate-500'}`}
        >
          {!hasValue && (
            <option value="" disabled hidden>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <i
          className="fa-solid fa-chevron-down pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500"
          aria-hidden="true"
        />
      </div>
      {error && (
        <p id={errorId} className="text-xs text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}
