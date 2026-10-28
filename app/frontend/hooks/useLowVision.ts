'use client';

import { useSyncExternalStore } from 'react';
import {
  LOW_VISION,
  LOW_VISION_DEFAULTS,
  LOW_VISION_KEY,
  restoreLowVision,
  type LowVisionSettings,
} from '@/lib/lowVision';

const listeners = new Set<() => void>();
let cache: { raw: string | null; value: LowVisionSettings } = { raw: null, value: LOW_VISION_DEFAULTS };

const readRaw = () => {
  try {
    return localStorage.getItem(LOW_VISION_KEY);
  } catch {
    return null;
  }
};

const stepIndex = (value: unknown, length: number) =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < length ? value : 0;

/** Сохранённое значение может быть чем угодно: неизвестное заменяется на «как на сайте». */
function parse(raw: string | null): LowVisionSettings {
  let saved: Partial<Record<keyof LowVisionSettings, unknown>> = {};
  try {
    const parsed = JSON.parse(raw ?? 'null');
    if (parsed && typeof parsed === 'object') saved = parsed;
  } catch {
    saved = {};
  }
  const font = saved.font;
  const scheme = saved.scheme;
  return {
    enabled: saved.enabled === true,
    size: stepIndex(saved.size, LOW_VISION.sizes.length),
    letter: stepIndex(saved.letter, LOW_VISION.letters.length),
    line: stepIndex(saved.line, LOW_VISION.lines.length),
    font: typeof font === 'string' && Object.hasOwn(LOW_VISION.fonts, font) ? (font as LowVisionSettings['font']) : 'site',
    scheme:
      typeof scheme === 'string' && Object.hasOwn(LOW_VISION.schemes, scheme)
        ? (scheme as LowVisionSettings['scheme'])
        : 'site',
  };
}

function getSnapshot() {
  const raw = readRaw();
  if (raw !== cache.raw) cache = { raw, value: parse(raw) };
  return cache.value;
}

function subscribe(onChange: () => void) {
  // Настройки, изменённые в другой вкладке, применяются и здесь.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== LOW_VISION_KEY) return;
    restoreLowVision(LOW_VISION_KEY, LOW_VISION);
    onChange();
  };
  listeners.add(onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onStorage);
  };
}

/** Настройки версии для слабовидящих: чтение, изменение и сброс; изменения сразу применяются к странице. */
export function useLowVision() {
  const settings = useSyncExternalStore(subscribe, getSnapshot, () => LOW_VISION_DEFAULTS);

  const save = (next: LowVisionSettings) => {
    try {
      localStorage.setItem(LOW_VISION_KEY, JSON.stringify(next));
    } catch {
      return; // без localStorage настройку негде хранить - страница остаётся как есть
    }
    restoreLowVision(LOW_VISION_KEY, LOW_VISION);
    listeners.forEach((listener) => listener());
  };

  return {
    settings,
    update: (patch: Partial<LowVisionSettings>) => save({ ...settings, ...patch }),
    reset: () => save({ ...LOW_VISION_DEFAULTS, enabled: settings.enabled }),
  };
}
