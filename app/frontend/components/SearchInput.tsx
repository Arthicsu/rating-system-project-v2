'use client';
import { useState, useEffect, useRef } from 'react';

interface SearchInputProps {
  onSearch: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
}

export default function SearchInput({ onSearch, placeholder = 'Поиск...', debounceMs = 200 }: SearchInputProps) {
  const [value, setValue] = useState('');

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
  const lastSent = useRef('');
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
        type="text"
        className="w-full min-w-0 rounded-full border border-slate-200 bg-white py-1.5 pl-7 pr-3 text-xs text-slate-900 placeholder:text-slate-400 outline-none ring-sky-500/0 transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/70 sm:text-sm"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </div>
  );
}
