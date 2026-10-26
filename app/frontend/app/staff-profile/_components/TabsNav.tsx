'use client';

import type { KeyboardEvent } from 'react';

import CountBadge from '@/components/CountBadge';

interface TabItem {
  id: string;
  label: string;
  /** Число заявок на бейдже; скрыт при 0/undefined. */
  badge?: number;
  /** alert — требует действия; neutral — для сведения (по умолчанию alert). */
  badgeTone?: 'alert' | 'neutral';
}

interface TabsNavProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
}

/**
 * Клавиатура списка вкладок по WAI-ARIA: стрелки, Home и End переключают вкладку и
 * переводят на неё фокус (в Tab-порядке только активная вкладка).
 */
export function handleTabListKey(
  e: KeyboardEvent<HTMLElement>,
  ids: string[],
  activeId: string,
  onChange: (id: string) => void,
) {
  const i = ids.indexOf(activeId);
  const next: Record<string, string | undefined> = {
    ArrowRight: ids[(i + 1) % ids.length],
    ArrowLeft: ids[(i - 1 + ids.length) % ids.length],
    Home: ids[0],
    End: ids[ids.length - 1],
  };
  const target = next[e.key];
  if (!target) return;
  e.preventDefault();
  onChange(target);
  e.currentTarget.querySelector<HTMLElement>(`[data-tab-id="${target}"]`)?.focus();
}

/** Переключатель вкладок кабинета сотрудника (Студенты / заявки / статистика). */
export default function TabsNav({ tabs, activeTab, onChange }: TabsNavProps) {
  return (
    <div
      role="tablist"
      aria-label="Разделы кабинета"
      onKeyDown={(e) => handleTabListKey(e, tabs.map((t) => t.id), activeTab, onChange)}
      className="flex overflow-x-auto border-b border-slate-200 pb-1.5 text-xs sm:text-sm"
    >
      {tabs.map((tab, i) => {
        const rounded = i === 0 ? 'rounded-l-md' : i === tabs.length - 1 ? 'rounded-r-md' : '';
        const selected = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            data-tab-id={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls="staff-tabpanel"
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={`cursor-pointer inline-flex items-center whitespace-nowrap ${rounded} px-4 py-2 font-medium transition ${
              selected
                ? 'bg-sky-700 text-white shadow-sm'
                : 'bg-slate-100 text-sky-700 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            {tab.label}
            <CountBadge count={tab.badge ?? 0} tone={tab.badgeTone} className="ml-1.5" />
          </button>
        );
      })}
    </div>
  );
}
