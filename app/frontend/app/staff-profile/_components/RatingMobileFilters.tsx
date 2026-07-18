'use client';

import CustomSelect from '@/components/CustomSelect';
import type { RatingFilterConfig } from '@/interfaces/RatingInterfaces';

interface RatingMobileFiltersProps {
  open: boolean;
  filters: RatingFilterConfig[];
}

/** Панель фильтров для узких экранов; раскрывается кнопкой MobileFilterToggle. */
export default function RatingMobileFilters({ open, filters }: RatingMobileFiltersProps) {
  if (!open) return null;

  return (
    <div className="mb-3 max-[411px]:block hidden rounded-lg bg-white p-3 shadow-[0_2px_10px_rgba(0,0,0,0.08)] text-[11px] text-slate-700">
      <div className="mb-2 font-semibold">Фильтры</div>
      <div className="space-y-2">
        {filters.map((f) => (
          <CustomSelect
            key={f.id}
            id={`m-${f.id}`}
            label={f.label}
            value={f.value}
            disabled={f.disabled}
            labelClassName="text-[10px] uppercase tracking-wide text-slate-500"
            triggerClassName="text-[11px] py-1 px-2"
            options={f.options}
            onChange={f.onChange}
          />
        ))}
      </div>
    </div>
  );
}
