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
 * Фильтры staff-профиля: мобильный блок + десктопная панель.
 *
 */
export default function FilterPanel({ filters, isRectorate, mobileFiltersOpen }: FilterPanelProps) {
  const {
    facultyId,
    course,
    groupId,
    semesterId,
    facultiesList,
    groupsList,
    semesterOptions,
    changeFaculty,
    changeCourse,
    changeGroup,
    changeSemester,
  } = filters;

  const semesterSelectOptions = semesterOptions.map((opt) => ({
    value: String(opt.id),
    label: opt.label,
  }));

  const handleSemesterChange = (value: string) => {
    const selected = semesterOptions.find((opt) => opt.id === Number(value));
    if (selected) {
      changeSemester(selected.id, selected.label);
    }
  };

  return (
    <>
      {mobileFiltersOpen && (
        <div className="mb-3 max-[640px]:block hidden rounded-lg bg-white p-3 shadow-[0_2px_10px_rgba(0,0,0,0.08)] text-[11px] text-sky-700">
          <div className="space-y-2">
            {isRectorate && (
            <CustomSelect
              id="m-faculty"
              label="Факультет"
              value={facultyId}
              labelClassName="text-[10px] uppercase tracking-wide text-sky-700"
              triggerClassName="text-[11px] py-1 px-2"
              options={[
                { value: 'all', label: 'Все' },
                ...facultiesList.map((f) => ({ value: String(f.id), label: f.short_name })),
              ]}
              onChange={changeFaculty}
            />
            )}
            <CustomSelect
              id="m-course"
              label="Курс"
              value={course}
              labelClassName="text-[10px] uppercase tracking-wide text-sky-700"
              triggerClassName="text-[11px] py-1 px-2"
              options={[
                { value: 'all', label: 'Все' },
                ...[1, 2, 3, 4, 5].map((c) => ({ value: String(c), label: `${c} курс` })),
              ]}
              onChange={changeCourse}
            />
            <CustomSelect
              id="m-group"
              label="Группа"
              value={groupId}
              labelClassName="text-[10px] uppercase tracking-wide text-sky-700"
              triggerClassName="text-[11px] py-1 px-2"
              options={[
                { value: 'all', label: 'Все' },
                ...groupsList.map((g) => ({ value: String(g.id), label: g.name })),
              ]}
              onChange={changeGroup}
            />
            <CustomSelect
              id="m-semester"
              label="Период"
              value={String(semesterId)}
              labelClassName="text-[10px] uppercase tracking-wide text-sky-700"
              triggerClassName="text-[11px] py-1 px-2"
              options={semesterSelectOptions}
              onChange={handleSemesterChange}
            />
          </div>
        </div>
      )}

      <div className="hidden sm:block mb-5 rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.12)] sm:p-5">
        <p className="mb-3 text-xl font-semibold text-slate-900 sm:text-2xl md:text-3xl">
          Фильтры
        </p>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 sm:gap-4">
          {isRectorate && (
          <CustomSelect
            id="faculty-select"
            label="Факультет"
            value={facultyId}
            labelClassName="block text-[11px] font-medium text-sky-700"
            triggerClassName="text-xs sm:text-sm"
            options={[
              { value: 'all', label: 'Все факультеты' },
              ...facultiesList.map((f) => ({ value: String(f.id), label: f.short_name })),
            ]}
            onChange={changeFaculty}
          />
          )}
          <CustomSelect
            id="course-select"
            label="Курс"
            value={course}
            labelClassName="block text-[11px] font-medium text-sky-700"
            triggerClassName="text-xs sm:text-sm"
            options={[
              { value: 'all', label: 'Все курсы' },
              ...[1, 2, 3, 4, 5].map((c) => ({ value: String(c), label: `${c} курс` })),
            ]}
            onChange={changeCourse}
          />
          <CustomSelect
            id="group-select"
            label="Группа"
            value={groupId}
            labelClassName="block text-[11px] font-medium text-sky-700"
            triggerClassName="text-xs sm:text-sm"
            options={
              groupsList.length > 0
                ? [
                    { value: 'all', label: 'Все группы' },
                    ...groupsList.map((g) => ({ value: String(g.id), label: g.name })),
                  ]
                : [{ value: 'all', label: 'Нет групп' }]
            }
            onChange={changeGroup}
          />
          <CustomSelect
            id="semester-select"
            label="Период"
            value={String(semesterId)}
            labelClassName="block text-[11px] font-medium text-sky-700"
            triggerClassName="text-xs sm:text-sm"
            options={semesterSelectOptions}
            onChange={handleSemesterChange}
          />
        </div>
      </div>
    </>
  );
}
