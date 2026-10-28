'use client';

import Switch from '@/components/Switch';
import { useLowVision } from '@/hooks/useLowVision';
import { LOW_VISION, type LowVisionFont, type LowVisionScheme } from '@/lib/lowVision';

const SPACING_LABELS = ['Обычный', 'Средний', 'Большой', 'Наибольший'];

const FONTS: { value: LowVisionFont; label: string }[] = [
  { value: 'site', label: 'Как на сайте' },
  { value: 'arial', label: 'Arial' },
  { value: 'times', label: 'Times New Roman' },
  { value: 'calibri', label: 'Calibri' },
  { value: 'courier', label: 'Courier' },
  { value: 'verdana', label: 'Verdana' },
];

const SCHEMES: { value: LowVisionScheme; label: string }[] = [
  { value: 'site', label: 'Как на сайте' },
  { value: 'black-white', label: 'Чёрный на белом' },
  { value: 'white-black', label: 'Белый на чёрном' },
  { value: 'blue', label: 'Синий на голубом' },
  { value: 'beige', label: 'Коричневый на бежевом' },
  { value: 'brown', label: 'Зелёный на коричневом' },
];

const STEP_BUTTON =
  'cursor-pointer inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-40';

const OPTION =
  'flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-3 py-1.5 text-center text-sm transition-colors has-focus-visible:ring-2 has-focus-visible:ring-sky-500 has-checked:border-sky-700 has-checked:bg-sky-50 has-checked:font-semibold has-checked:text-sky-800 border-slate-200 text-slate-700 hover:bg-slate-50';

interface StepperProps {
  id: string;
  label: string;
  value: string;
  index: number;
  count: number;
  onChange: (index: number) => void;
}

/** Строка «подпись − значение +»; значение объявляется экранным дикторам при изменении. */
function Stepper({ id, label, value, index, count, onChange }: StepperProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <p id={id} className="text-sm text-slate-700">
        {label}
      </p>
      <div role="group" aria-labelledby={id} className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(index - 1)}
          disabled={index <= 0}
          aria-label={`${label}: меньше`}
          className={STEP_BUTTON}
        >
          <i className="fa-solid fa-minus" aria-hidden="true" />
        </button>
        <output aria-live="polite" className="min-w-28 text-center text-sm font-semibold text-slate-900">
          {value}
        </output>
        <button
          type="button"
          onClick={() => onChange(index + 1)}
          disabled={index >= count - 1}
          aria-label={`${label}: больше`}
          className={STEP_BUTTON}
        >
          <i className="fa-solid fa-plus" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/**
 * Версия для слабовидящих (как на ЭОС): размер шрифта, интервалы, шрифт и контрастные цвета.
 * Действует на всех страницах в этом браузере, в светлой и тёмной теме.
 */
export default function LowVisionSettings() {
  const { settings, update, reset } = useLowVision();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <p id="low-vision-label" className="text-sm font-medium text-slate-800">
            Версия для слабовидящих
          </p>
          <p id="low-vision-hint" className="text-sm text-slate-500">
            Крупный шрифт, интервалы и контрастные цвета на всех страницах в этом браузере.
          </p>
        </div>
        <Switch
          checked={settings.enabled}
          onToggle={() => update({ enabled: !settings.enabled })}
          labelledBy="low-vision-label"
          describedBy="low-vision-hint"
        />
      </div>

      {settings.enabled && (
        <div className="space-y-4 rounded-xl border border-slate-100 bg-slate-50 p-3 sm:p-4">
          <Stepper
            id="low-vision-size"
            label="Размер шрифта"
            value={`${Math.round(LOW_VISION.sizes[settings.size] * 100)}%`}
            index={settings.size}
            count={LOW_VISION.sizes.length}
            onChange={(size) => update({ size })}
          />
          <Stepper
            id="low-vision-letter"
            label="Интервал между буквами"
            value={SPACING_LABELS[settings.letter]}
            index={settings.letter}
            count={LOW_VISION.letters.length}
            onChange={(letter) => update({ letter })}
          />
          <Stepper
            id="low-vision-line"
            label="Интервал между строками"
            value={SPACING_LABELS[settings.line]}
            index={settings.line}
            count={LOW_VISION.lines.length}
            onChange={(line) => update({ line })}
          />

          <fieldset className="space-y-2">
            <legend className="text-sm text-slate-700">Шрифт</legend>
            <div className="flex flex-wrap gap-2">
              {FONTS.map((font) => (
                <label key={font.value} className={OPTION} style={{ fontFamily: LOW_VISION.fonts[font.value] || undefined }}>
                  <input
                    type="radio"
                    name="low-vision-font"
                    value={font.value}
                    checked={settings.font === font.value}
                    onChange={() => update({ font: font.value })}
                    className="sr-only"
                  />
                  {font.label}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm text-slate-700">Цвета</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {SCHEMES.map((scheme) => {
                const colors = LOW_VISION.schemes[scheme.value];
                return (
                  <label key={scheme.value} className={`${OPTION} flex-col gap-1.5 py-2`}>
                    <input
                      type="radio"
                      name="low-vision-scheme"
                      value={scheme.value}
                      checked={settings.scheme === scheme.value}
                      onChange={() => update({ scheme: scheme.value })}
                      className="sr-only"
                    />
                    {/* Образец не перекрашивается контрастной схемой - иначе все образцы стали бы одинаковыми. */}
                    <span
                      data-lv-keep
                      aria-hidden="true"
                      className={`flex h-9 w-full items-center justify-center rounded-md border text-lg font-semibold ${colors ? '' : 'border-slate-200 bg-white text-slate-900'}`}
                      style={colors ? { color: colors.fg, backgroundColor: colors.bg, borderColor: colors.fg } : undefined}
                    >
                      Аа
                    </span>
                    {scheme.label}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <button
            type="button"
            onClick={reset}
            className="cursor-pointer inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <i className="fa-solid fa-rotate-left" aria-hidden="true" />
            Сбросить настройки
          </button>
        </div>
      )}
    </div>
  );
}
