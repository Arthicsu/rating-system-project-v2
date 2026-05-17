'use client';

import Link from 'next/link';

type ErrorStateProps = {
  code?: number;
  title?: string;
  description?: string;
  message?: string;
  onReset?: () => void;
};

export default function ErrorState({
  code = 500,
  title,
  description,
  message,
  onReset,
}: ErrorStateProps) {
  const defaultMessages: Record<number, { title: string; description: string }> = {
    400: { title: 'Некорректный запрос', description: 'Проверьте введённые данные и попробуйте снова.' },
    401: { title: 'Требуется авторизация', description: 'Пожалуйста, войдите в систему.' },
    403: { title: 'Доступ запрещён', description: 'У вас недостаточно прав для выполнения этого действия.' },
    404: { title: 'Страница не найдена', description: 'Похоже, такой страницы не существует или она была перемещена.' },
    429: { title: 'Слишком много запросов', description: 'Подождите немного перед повторной попыткой.' },
    500: { title: 'Внутренняя ошибка сервера', description: 'Произошла непредвиденная ошибка. Повторите запрос позже.' },
    502: { title: 'Сервис временно недоступен', description: 'Сервер получил некорректный ответ от вышестоящего сервиса.' },
    503: { title: 'Сервис недоступен', description: 'Сервис временно недоступен. Попробуйте позже.' },
  };

  const defaultInfo = defaultMessages[code] || { title: 'Произошла ошибка', description: 'Попробуйте обновить страницу или вернуться на главную.' };

  const displayTitle = title || defaultInfo.title;
  const displayDescription = description || defaultInfo.description;
  
  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 text-center shadow-[0_6px_20px_rgba(0,0,0,0.08)] sm:p-8">
        <p className="text-5xl font-bold text-sky-700 sm:text-9xl">{code}</p>
        <h1 className="mt-3 text-xl font-semibold text-slate-800 sm:text-2xl">{displayTitle}</h1>
        <p className="mt-2 text-sm text-slate-600 sm:text-base">{displayDescription}</p>
        {message && (
          <p className="mt-2 text-xs text-red-500 sm:text-sm">{message}</p>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 ">
          {onReset && (
            <button
              onClick={onReset}
              className="cursor-pointer inline-flex items-center rounded-md bg-sky-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-800"
            >
              Попробовать снова
            </button>
          )}
          <Link
            href="/"
            className="inline-flex items-center rounded-md bg-sky-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-800"
          >
            На главную
          </Link>
        </div>
      </div>
    </div>
  );
}
