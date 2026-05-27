'use client';
import { useState, useEffect, useRef } from 'react';

interface SearchInputProps {
  onSearch: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
}

export default function SearchInput({ onSearch, placeholder = 'Поиск...', debounceMs = 200 }: SearchInputProps) {
  const [value, setValue] = useState('');
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = setTimeout(() => onSearch(value), debounceMs);
    return () => clearTimeout(timer);
  }, [value, debounceMs, onSearch]);

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
