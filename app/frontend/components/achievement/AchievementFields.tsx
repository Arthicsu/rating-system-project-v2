'use client';

import type { UseFormReturn } from 'react-hook-form';

import CustomSelect from '@/components/CustomSelect';
import type { AchievementConfigResponse, SelectOption } from '@/interfaces/AchievementInterfaces';
import type { AchievementFieldValues } from '@/lib/validation/achievement';

/** Балл по правилам вида деятельности для выбранных уровня и результата; null — правила нет. */
export function getCurrentScore(
  subType?: SelectOption | null,
  level?: SelectOption | null,
  result?: SelectOption | null,
): number | null {
  if (!subType?.scoring_rules) return null;
  const rule = subType.scoring_rules.find((r) => {
    const levelMatch = subType.needsLevel ? r.level === level?.code : r.level === null;
    const resultMatch = subType.needsResult ? r.result === result?.code : r.result === null;
    return levelMatch && resultMatch;
  });
  return rule?.score ?? null;
}

/** Подпись ошибки под полем; ничего не рендерит, пока поле валидно. */
export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-rose-700">{message}</p>;
}

const LABEL = 'text-xs font-medium text-slate-600';
// 16 px на телефоне: iOS не увеличивает страницу при фокусе на поле меньше 16 px.
const INPUT =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-base text-slate-900 shadow-sm outline-none transition placeholder:text-slate-500 focus:border-sky-600 focus:bg-white focus:ring-2 focus:ring-sky-600 sm:text-sm';

interface AchievementFieldsProps<T extends AchievementFieldValues, C, R> {
  form: UseFormReturn<T, C, R>;
  config?: AchievementConfigResponse;
  /** Префикс id полей: подписи связаны с полями и на странице загрузки, и в окне правки. */
  idPrefix: string;
}

/**
 * Поля заявки — общие для загрузки и правки: категория → вид деятельности → уровень →
 * результат (каскадный сброс), тип документа, название и дата получения.
 */
export default function AchievementFields<T extends AchievementFieldValues, C, R>({
  form,
  config,
  idPrefix,
}: AchievementFieldsProps<T, C, R>) {
  // Поля общие для схем загрузки и правки; react-hook-form не сужает Path<T> к общему предку.
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = form as unknown as UseFormReturn<AchievementFieldValues>;

  const dataStructure = config?.structure ?? {};
  const levelsList = config?.levels ?? [];
  const resultsList = config?.results ?? [];
  const docTypesList = config?.doc_types ?? [];

  const category = watch('category');
  const subType = watch('subType');
  const level = watch('level');
  const result = watch('result');
  const docType = watch('docType');
  const achievementName = watch('achievement') ?? '';

  const allowedOnly = (list: SelectOption[], allowed?: string[]) =>
    allowed && allowed.length > 0 ? list.filter((item) => allowed.includes(item.code)) : list;
  const levels = allowedOnly(levelsList, subType?.allowedLevels);
  const results = allowedOnly(resultsList, subType?.allowedResults);
  const subTypes = category ? dataStructure[category]?.sub_types ?? [] : [];

  return (
    <>
      <div>
        <CustomSelect
          id={`${idPrefix}-category`}
          label="Категория (обязательно)"
          value={category ?? ''}
          placeholder="Выберите категорию"
          options={Object.keys(dataStructure).map((key) => ({ value: key, label: dataStructure[key].label }))}
          onChange={(value) => {
            // Каскад: смена категории сбрасывает вид/уровень/результат.
            setValue('category', value, { shouldValidate: true });
            setValue('subType', null);
            setValue('level', null);
            setValue('result', null);
          }}
          error={errors.category?.message}
        />
      </div>

      {category && (
        <div>
          <CustomSelect
            id={`${idPrefix}-sub-type`}
            label="Вид деятельности (обязательно)"
            value={subType?.code ?? ''}
            placeholder="Выберите вид деятельности"
            options={subTypes.map((item) => ({ value: item.code, label: item.label }))}
            onChange={(value) => {
              const selected = subTypes.find((item) => item.code === value);
              if (selected) {
                setValue('subType', selected, { shouldValidate: true });
                setValue('level', null);
                setValue('result', null);
              }
            }}
            error={errors.subType?.message}
          />
        </div>
      )}

      {subType?.needsLevel && (
        <div>
          <CustomSelect
            id={`${idPrefix}-level`}
            label="Уровень мероприятия (обязательно)"
            value={level?.code ?? ''}
            placeholder="Выберите уровень"
            options={levels.map((item) => ({ value: item.code, label: item.label }))}
            onChange={(value) => {
              const selected = levels.find((item) => item.code === value);
              if (selected) setValue('level', selected, { shouldValidate: true });
            }}
            error={errors.level?.message}
          />
        </div>
      )}

      {subType?.needsResult && (
        <div>
          <CustomSelect
            id={`${idPrefix}-result`}
            label="Результат / Место (обязательно)"
            value={result?.code ?? ''}
            placeholder="Выберите результат"
            options={results.map((item) => ({ value: item.code, label: item.label }))}
            onChange={(value) => {
              const selected = results.find((item) => item.code === value);
              if (selected) setValue('result', selected, { shouldValidate: true });
            }}
            error={errors.result?.message}
          />
        </div>
      )}

      <div>
        <CustomSelect
          id={`${idPrefix}-doc-type`}
          label="Тип документа (обязательно)"
          value={docType?.code ?? ''}
          placeholder="Выберите тип документа"
          options={docTypesList.map((item) => ({ value: item.code, label: item.label }))}
          onChange={(value) => {
            const selected = docTypesList.find((item) => item.code === value);
            if (selected) setValue('docType', selected, { shouldValidate: true });
          }}
          error={errors.docType?.message}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor={`${idPrefix}-achievement`} className={LABEL}>
          Название достижения (обязательно)
        </label>
        <div className="relative">
          <textarea
            id={`${idPrefix}-achievement`}
            className={`${INPUT} resize-none pb-5`}
            rows={2}
            maxLength={1000}
            placeholder="Название как в документе"
            {...register('achievement')}
          />
          <span className="absolute bottom-1.5 right-2 text-xs text-slate-500" aria-hidden="true">
            {achievementName.length}/1000
          </span>
        </div>
        <FieldError message={errors.achievement?.message} />
      </div>

      <div className="space-y-1.5">
        <label htmlFor={`${idPrefix}-date-received`} className={LABEL}>
          Дата получения достижения (обязательно)
        </label>
        <input id={`${idPrefix}-date-received`} className={`${INPUT} min-h-11 sm:min-h-0`} type="date" {...register('dateReceived')} />
        <FieldError message={errors.dateReceived?.message} />
      </div>
    </>
  );
}
