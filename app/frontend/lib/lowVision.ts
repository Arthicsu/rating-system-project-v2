/** Версия для слабовидящих: настройки хранятся в localStorage браузера и ставятся атрибутами и переменными на <html>. */

export const LOW_VISION_KEY = 'low-vision';

export type LowVisionFont = 'site' | 'arial' | 'times' | 'calibri' | 'courier' | 'verdana';
export type LowVisionScheme = 'site' | 'black-white' | 'white-black' | 'blue' | 'beige' | 'brown';

export interface LowVisionSettings {
  enabled: boolean;
  /** Индексы шагов в LOW_VISION.sizes / letters / lines; 0 - как на сайте. */
  size: number;
  letter: number;
  line: number;
  font: LowVisionFont;
  scheme: LowVisionScheme;
}

export const LOW_VISION_DEFAULTS: LowVisionSettings = {
  enabled: false,
  size: 0,
  letter: 0,
  line: 0,
  font: 'site',
  scheme: 'site',
};

/** Только данные: таблица уходит во встроенный скрипт как JSON. Схемы - по ГОСТ Р 52872 (контраст от 7,7:1). */
export const LOW_VISION = {
  sizes: [1, 1.25, 1.5, 1.75, 2],
  letters: ['', '0.05em', '0.1em', '0.15em'],
  lines: ['', '1.6', '1.9', '2.2'],
  fonts: {
    site: '',
    arial: 'Arial, Helvetica, sans-serif',
    times: '"Times New Roman", Times, serif',
    calibri: 'Calibri, Carlito, sans-serif',
    courier: '"Courier New", Courier, monospace',
    verdana: 'Verdana, Geneva, sans-serif',
  } as Record<LowVisionFont, string>,
  schemes: {
    site: null,
    'black-white': { fg: '#000000', bg: '#ffffff' },
    'white-black': { fg: '#ffffff', bg: '#000000' },
    blue: { fg: '#063462', bg: '#9dd1ff' },
    beige: { fg: '#4d4b43', bg: '#f7f3d6' },
    brown: { fg: '#a9e44d', bg: '#3b2716' },
  } as Record<LowVisionScheme, { fg: string; bg: string } | null>,
};

/**
 * Читает настройки из localStorage и ставит их на <html>. Функция без внешних ссылок: она же
 * исполняется встроенным скриптом до первой отрисовки (через toString) - без мигания обычного вида.
 * Значения из хранилища не доверенные: берутся только известные шаги и ключи таблицы.
 */
export function restoreLowVision(key: string, table: typeof LOW_VISION) {
  try {
    const root = document.documentElement;
    let saved: Record<string, unknown> | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(key) || 'null');
    } catch {
      saved = null;
    }
    const on = !!saved && typeof saved === 'object' && saved.enabled === true;
    const step = <T>(list: T[], index: unknown): T | undefined =>
      on && typeof index === 'number' && Number.isInteger(index) && index > 0 && index < list.length
        ? list[index]
        : undefined;
    const known = <T>(map: Record<string, T>, name: unknown): T | undefined =>
      on && typeof name === 'string' && Object.prototype.hasOwnProperty.call(map, name) ? map[name] : undefined;
    const setVar = (name: string, value: string | undefined) => {
      if (value) root.style.setProperty(name, value);
      else root.style.removeProperty(name);
    };
    const setFlag = (name: string, value: unknown) => {
      if (value) root.setAttribute(name, '');
      else root.removeAttribute(name);
    };

    const size = step(table.sizes, saved && saved.size);
    const letter = step(table.letters, saved && saved.letter);
    const line = step(table.lines, saved && saved.line);
    const font = known(table.fonts, saved && saved.font);
    const scheme = known(table.schemes, saved && saved.scheme);

    setFlag('data-lv-size', size);
    setVar('--lv-scale', size ? String(size) : undefined);
    setFlag('data-lv-letter', letter);
    setVar('--lv-letter', letter);
    setFlag('data-lv-line', line);
    setVar('--lv-line', line);
    setVar('--default-font-family', font);
    setFlag('data-lv-scheme', scheme);
    setVar('--lv-fg', scheme ? scheme.fg : undefined);
    setVar('--lv-bg', scheme ? scheme.bg : undefined);
  } catch {
    // Без localStorage (запрет сайтовых данных) страница остаётся в обычном виде.
  }
}

// Применяет сохранённое при загрузке и при изменении в другой вкладке. JSON с экранированным «<» -
// строка не может закрыть тег <script>.
const scriptJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');
export const LOW_VISION_SCRIPT = `(function (apply, key, table) {
  apply(key, table);
  window.addEventListener('storage', function (event) {
    if (event.key === key) apply(key, table);
  });
})(${restoreLowVision.toString()}, ${scriptJson(LOW_VISION_KEY)}, ${scriptJson(LOW_VISION)})`;
