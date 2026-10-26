'use client';

import CustomSelect from '@/components/CustomSelect';
import { handleTabListKey } from './TabsNav';
import type { Tab } from '@/interfaces/RatingInterfaces';

interface RatingTabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
}

/** Переключатель категории рейтинга: на узких экранах селект, на широких ряд кнопок. */
export default function RatingTabs({ tabs, activeTab, onChange }: RatingTabsProps) {
  return (
    <div className="mb-5">
      <div className="block sm:hidden">
        <CustomSelect
          id="tab-select"
          label="Категория рейтинга"
          value={activeTab}
          options={tabs.map((tab) => ({ value: tab.id, label: tab.label }))}
          onChange={onChange}
        />
      </div>

      <div
        role="tablist"
        aria-label="Категория рейтинга"
        onKeyDown={(e) => handleTabListKey(e, tabs.map((t) => t.id), activeTab, onChange)}
        className="hidden sm:inline-flex overflow-hidden rounded-lg bg-white shadow-[0_2px_10px_rgba(0,0,0,0.05)] text-xs md:text-sm lg:text-base"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            data-tab-id={tab.id}
            aria-selected={activeTab === tab.id}
            tabIndex={activeTab === tab.id ? 0 : -1}
            className={`cursor-pointer border-r border-[#f0f0f0] px-1.5 sm:px-2 md:px-3 lg:px-4 py-1 sm:py-1.5 md:py-2 lg:py-3 transition-colors last:border-r-0 ${
              activeTab === tab.id
                ? 'bg-sky-700 text-white'
                : 'bg-transparent text-[#333] hover:bg-[#e9ecef]'
            }`}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
