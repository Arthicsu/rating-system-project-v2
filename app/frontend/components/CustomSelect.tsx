'use client';

export interface CustomSelectOption {
  value: string;
  label: string;
}

export interface CustomSelectProps {
  id?: string;
  label?: string;
  value: string;
  options: CustomSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  className?: string;
  labelClassName?: string;
  triggerClassName?: string;
  inline?: boolean;
}

const selectBaseClassName =
  'cursor-pointer w-full truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none transition hover:border-sky-600 hover:bg-white focus:border-sky-600 focus:ring-2 focus:ring-sky-600 disabled:cursor-not-allowed disabled:opacity-60';

/**
 * Стилизованный нативный <select>: клавиатура и скринридеры из коробки,
 * стрелку и выпадающий список рисует браузер.
 */
export default function CustomSelect({
  id,
  label,
  value,
  options,
  placeholder = 'Выберите значение',
  disabled = false,
  onChange,
  className = '',
  labelClassName = 'text-[11px] font-medium text-slate-500',
  triggerClassName = '',
  inline = false,
}: CustomSelectProps) {
  // Значение вне списка (например, семестры ещё не загрузились) — показываем placeholder.
  const hasValue = options.some((option) => option.value === value);

  const wrapperClassName = inline
    ? `relative flex flex-col items-center justify-center gap-1.5 sm:gap-2 text-center ${className}`
    : `relative space-y-1.5 ${className}`;

  return (
    <div className={wrapperClassName} onClick={(e) => e.stopPropagation()}>
      {label && (
        <label htmlFor={id} className={labelClassName}>
          {label}
        </label>
      )}
      <select
        id={id}
        value={hasValue ? value : ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`${selectBaseClassName} ${!hasValue ? 'text-slate-400' : ''} ${triggerClassName}`}
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
    </div>
  );
}
