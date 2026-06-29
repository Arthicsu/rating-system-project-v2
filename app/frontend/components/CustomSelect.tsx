'use client';

import { useEffect, useRef, useState } from 'react';

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

const triggerBaseClassName =
  'cursor-pointer flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none ring-sky-600/0 transition hover:border-sky-600 hover:bg-white focus:border-sky-600 focus:ring-2 focus:ring-sky-600 disabled:cursor-not-allowed disabled:opacity-60';

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
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((option) => option.value === value);
  const displayLabel = selectedOption?.label ?? placeholder;

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  const wrapperClassName = inline
    ? `relative flex flex-col items-center justify-center gap-1.5 sm:gap-2 text-center ${className}`
    : `relative space-y-1.5 ${className}`;

  return (
    <div
      ref={containerRef}
      className={wrapperClassName}
      onClick={(e) => e.stopPropagation()}
    >
      {label && (
        <label htmlFor={id} className={labelClassName}>
          {label}
        </label>
      )}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) {
            setIsOpen((prev) => !prev);
          }
        }}
        className={`${triggerBaseClassName} ${triggerClassName}`}
      >
        <span className={`truncate ${!selectedOption ? 'text-slate-400' : ''}`}>
          {displayLabel}
        </span>
        <span className="ml-2 shrink-0 text-xs text-slate-400">▼</span>
      </button>
      {isOpen && !disabled && (
        <div className="absolute left-0 top-full z-30 mt-1 max-h-60 w-full min-w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-xl">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`cursor-pointer block w-full px-3 py-1.5 text-left text-sm text-slate-800 hover:bg-slate-50 ${
                option.value === value ? 'bg-slate-100 font-medium' : ''
              }`}
              onClick={() => handleSelect(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
