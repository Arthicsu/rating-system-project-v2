'use client';
import { useState, useEffect, useRef } from 'react';

interface SearchInputProps {
  onSearch: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  /** Уже применённый поиск (из адреса страницы или до смены вкладки). */
  initialValue?: string;
}

export default function SearchInput({ onSearch, placeholder = 'Поиск...', debounceMs = 200, initialValue = '' }: SearchInputProps) {
  const [value, setValue] = useState(initialValue);

  // onSearch живёт в ref, а не в зависимостях debounce-эффекта: родители передают
  // его инлайн-функцией, и новая ссылка на каждый рендер перезапускала бы таймер.
  const onSearchRef = useRef(onSearch);
  useEffect(() => {
    onSearchRef.current = onSearch;
  });

  // Родитель узнаёт только о реально изменившемся значении. Сравнение с последним
  // отправленным (а не флаг первого рендера) переживает двойной прогон эффектов
  // в StrictMode: иначе на маунте улетал onSearch('') и сбрасывал пагинацию,
  // в т.ч. страницу из ?page= при открытии по прямой ссылке.
  const lastSent = useRef(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (lastSent.current === value) return;
    const timer = setTimeout(() => {
      lastSent.current = value;
      onSearchRef.current(value);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [value, debounceMs]);

  return (
    <div className="relative flex items-center flex-1 min-w-0">
      <i className="fa-solid fa-magnifying-glass pointer-events-none absolute left-3 text-[11px] text-slate-400" />
      <input
        ref={inputRef}
        type="text"
        className="w-full min-w-0 rounded-full border border-slate-200 bg-white min-h-11 py-1.5 pl-7 pr-11 text-base sm:min-h-0 sm:pr-9 text-slate-900 placeholder:text-slate-400 outline-none ring-sky-500/0 transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/70 sm:text-sm"
        placeholder={placeholder}
        value={value}
        maxLength={100}
        aria-label={placeholder}
        onChange={(e) => setValue(e.target.value)}
      />
      {value && (
        <button
          type="button"
          aria-label="Очистить поиск"
          onClick={() => {
            setValue('');
            inputRef.current?.focus();
          }}
          className="cursor-pointer absolute right-0 inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 sm:right-1 sm:h-8 sm:w-8"
        >
          <i className="fa-solid fa-xmark" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
