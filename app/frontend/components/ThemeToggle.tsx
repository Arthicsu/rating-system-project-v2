'use client';

import { useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';

const OPTIONS = [
  { value: 'system', label: 'Как в системе', icon: 'fa-solid fa-desktop' },
  { value: 'light', label: 'Светлая', icon: 'fa-solid fa-sun' },
  { value: 'dark', label: 'Тёмная', icon: 'fa-solid fa-moon' },
] as const;

const noSubscribe = () => () => {};

/**
 * Выбор темы: как в системе, светлая, тёмная. Выбор next-themes хранит в localStorage браузера.
 * Нативные радиокнопки дают переход стрелками и чтение экранными дикторами без своего кода.
 */
export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // На сервере тема неизвестна: до гидрации ни один вариант не отмечен, разметка совпадает.
  const mounted = useSyncExternalStore(noSubscribe, () => true, () => false);

  return (
    <fieldset className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
      <legend className="sr-only">Тема оформления</legend>
      {OPTIONS.map((option) => {
        const checked = mounted && theme === option.value;
        return (
          <label
            key={option.value}
            className={`flex min-h-11 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-center text-xs font-medium transition-colors has-focus-visible:ring-2 has-focus-visible:ring-sky-500 sm:flex-row sm:gap-2 sm:text-sm ${
              checked ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <input
              type="radio"
              name="theme"
              value={option.value}
              checked={checked}
              onChange={() => setTheme(option.value)}
              className="sr-only"
            />
            <i className={option.icon} aria-hidden="true" />
            {option.label}
          </label>
        );
      })}
    </fieldset>
  );
}
