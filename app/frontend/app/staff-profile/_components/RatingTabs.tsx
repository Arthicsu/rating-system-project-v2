'use client';

import CustomSelect from '@/components/CustomSelect';
import StateFilter from '@/components/StateFilter';
import type { Tab } from '@/interfaces/RatingInterfaces';

interface RatingTabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
}

/** Переключатель категории рейтинга: на узких экранах селект, на широких таблетки, как категории в профиле. */
export default function RatingTabs({ tabs, activeTab, onChange }: RatingTabsProps) {
  return (
    <div className="mb-4">
      <div className="sm:hidden">
        <CustomSelect
          id="tab-select"
          label="Категория рейтинга"
          value={activeTab}
          options={tabs.map((tab) => ({ value: tab.id, label: tab.label }))}
          onChange={onChange}
        />
      </div>

      <div className="hidden sm:block">
        <StateFilter
          label="Категория рейтинга"
          options={tabs.map((tab) => ({ value: tab.id, label: tab.label }))}
          value={activeTab}
          onChange={onChange}
        />
      </div>
    </div>
  );
}
