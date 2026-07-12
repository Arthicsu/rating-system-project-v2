import type { AxiosError } from 'axios';

/**
 * Достаёт сообщение из ошибки DRF.
 * Формат ответа: либо { detail: "..." }, либо { field: ["..."] } от валидации.
 * Берём первое поле ответа (у DRF это и есть суть ошибки), иначе фолбэк.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const err = error as AxiosError<Record<string, string | string[]>>;
  const data = err.response?.data;
  if (data && typeof data === 'object') {
    const firstKey = Object.keys(data)[0];
    if (firstKey) {
      const value = data[firstKey];
      const msg = Array.isArray(value) ? value[0] : value;
      if (typeof msg === 'string' && msg) return msg;
    }
  }
  return fallback;
}
