'use client';

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

/** Переключатель вкладок кабинета сотрудника (Группа / заявки / статистика). */
export default function TabsNav({ tabs, activeTab, onChange }: TabsNavProps) {
  return (
    <div className="flex overflow-x-auto border-b border-slate-200 pb-1.5 text-xs sm:text-sm">
      {tabs.map((tab, i) => {
        const rounded = i === 0 ? 'rounded-l-md' : i === tabs.length - 1 ? 'rounded-r-md' : '';
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`cursor-pointer inline-flex items-center whitespace-nowrap ${rounded} px-4 py-2 font-medium transition ${
              activeTab === tab.id
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
