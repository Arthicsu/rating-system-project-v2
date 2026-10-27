'use client';

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
 * блок, и десктопная панель (различаются только обёрткой и классами).
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
    },
    {
      id: 'period',
      label: 'Период',
      value: period,
      options: periodOptions,
      onChange: changePeriod,
      // «2025-2026 уч. год — весна» в одну колонку не входит: обрезалось бы само слово семестра.
      className: 'md:col-span-2',
      extra: (
        <label className="mt-1.5 inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-slate-700 sm:min-h-0">
          <input
            type="checkbox"
            checked={onlyCurrentYear}
            onChange={(e) => changeOnlyCurrentYear(e.target.checked)}
            className="size-4 cursor-pointer accent-sky-700"
          />
          Только текущий учебный год
        </label>
      ),
    },
  ];

  return (
    <>
      {mobileFiltersOpen && (
        <div id="mobile-filters" className="mb-3 max-[640px]:block hidden rounded-lg bg-white p-3 shadow-[0_2px_10px_rgba(0,0,0,0.08)] text-xs text-sky-700">
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
                {s.extra}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="hidden sm:block mb-5 rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.12)] sm:p-5">
        <p className="mb-3 text-xl font-semibold text-slate-900 sm:text-2xl md:text-3xl">
          Фильтры
        </p>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 sm:gap-4">
          {selects.map((s) => (
            <div key={s.id} className={s.className}>
              <CustomSelect
                id={`${s.id}-select`}
                label={s.label}
                value={s.value}
                size="sm"
                options={s.options}
                onChange={s.onChange}
              />
              {s.extra}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
