import hotToast, { type ToastOptions } from 'react-hot-toast';

/** Время на прочтение: 60 мс на знак, от 3 до 10 секунд; ошибкам - в полтора раза дольше. */
function readTime(message: string, factor = 1) {
  return Math.round(Math.min(10_000, Math.max(3_000, message.length * 60)) * factor);
}

/**
 * react-hot-toast с длительностью по длине текста; ошибки - role=alert (роль задаётся при создании
 * уведомления, общие настройки Toaster её не меняют). Остальное (loading, dismiss, …) - как в библиотеке.
 */
const toast = Object.assign(
  (message: string, options?: ToastOptions) => hotToast(message, { duration: readTime(message), ...options }),
  hotToast,
  {
    success: (message: string, options?: ToastOptions) =>
      hotToast.success(message, { duration: readTime(message), ...options }),
    error: (message: string, options?: ToastOptions) =>
      hotToast.error(message, {
        duration: readTime(message, 1.5),
        ariaProps: { role: 'alert', 'aria-live': 'assertive' },
        ...options,
      }),
  },
);

export default toast;
