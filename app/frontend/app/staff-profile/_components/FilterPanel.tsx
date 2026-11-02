'use client';

import Card from '@/components/Card';
import CustomSelect from '@/components/CustomSelect';
import type { StaffFilters } from '@/hooks/useStaffFilters';

interface FilterPanelProps {
  filters: StaffFilters;
  isRectorate: boolean;
  /** Открыт ли мобильный блок фильтров (кнопка-бургер живёт на странице). */
  mobileFiltersOpen: boolean;
}

/**
 * Фильтры staff-профиля: один конфиг селектов, который рендерят и мобильный
 * блок, и строка фильтров на ПК (различаются только обёрткой и классами).
 */
export default function FilterPanel({ filters, isRectorate, mobileFiltersOpen }: FilterPanelProps) {
  const {
    facultyId,
    course,
    groupId,
    period,
    periodOptions,
    onlyCurrentYear,
    changeOnlyCurrentYear,
    facultiesList,
    groupsList,
    changeFaculty,
    changeCourse,
    changeGroup,
    changePeriod,
  } = filters;

  const selects = [
    ...(isRectorate
      ? [{
          id: 'faculty',
          label: 'Факультет',
          value: facultyId,
          options: [
            { value: 'all', label: 'Все факультеты' },
            ...facultiesList.map((f) => ({ value: String(f.id), label: f.short_name })),
          ],
          onChange: changeFaculty,
          width: 'w-40',
        }]
      : []),
    {
      id: 'course',
      label: 'Курс',
      value: course,
      options: [
        { value: 'all', label: 'Все курсы' },
        ...[1, 2, 3, 4, 5].map((c) => ({ value: String(c), label: `${c} курс` })),
      ],
      onChange: changeCourse,
      width: 'w-32',
    },
    {
      id: 'group',
      label: 'Группа',
      value: groupId,
      options:
        groupsList.length > 0
          ? [
              { value: 'all', label: 'Все группы' },
              ...groupsList.map((g) => ({ value: String(g.id), label: g.name })),
            ]
          : [{ value: 'all', label: 'Нет групп' }],
      onChange: changeGroup,
      width: 'w-40',
    },
    {
      id: 'period',
      label: 'Период',
      value: period,
      options: periodOptions,
      onChange: changePeriod,
      // Шире остальных: в узком поле «2025-2026 уч. год — весна» обрезалось бы на самом слове семестра.
      width: 'w-64',
    },
  ];

  const onlyCurrentYearBox = (
    <input
      type="checkbox"
      checked={onlyCurrentYear}
      onChange={(e) => changeOnlyCurrentYear(e.target.checked)}
      className="size-4 cursor-pointer accent-sky-700"
    />
  );

  return (
    <>
      {mobileFiltersOpen && (
        <Card padding="sm" id="mobile-filters" className="mb-3 hidden max-[640px]:block">
          <div className="space-y-2">
            {selects.map((s) => (
              <div key={s.id}>
                <CustomSelect
                  id={`m-${s.id}`}
                  label={s.label}
                  value={s.value}
                  options={s.options}
                  onChange={s.onChange}
                />
                {s.id === 'period' && (
                  <label className="mt-1.5 inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-slate-700 sm:min-h-0">
                    {onlyCurrentYearBox}
                    Только текущий учебный год
                  </label>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <div role="group" aria-label="Фильтры" className="mb-4 hidden flex-wrap items-end gap-x-3 gap-y-2 sm:flex">
        {selects.map((s) => (
          <CustomSelect
            key={s.id}
            id={`${s.id}-select`}
            label={s.label}
            value={s.value}
            size="sm"
            options={s.options}
            onChange={s.onChange}
            className={s.width}
          />
        ))}
        <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 text-sm text-slate-700">
          {onlyCurrentYearBox}
          Только текущий учебный год
        </label>
      </div>
    </>
  );
}
