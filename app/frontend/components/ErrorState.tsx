'use client';

import Link from 'next/link';
import Button, { buttonClass } from '@/components/Button';
import Card from '@/components/Card';
import { PAGE_TITLE } from '@/components/layout/PageHeader';

type ErrorStateProps = {
  code?: number;
  title?: string;
  description?: string;
  message?: string;
  onReset?: () => void;
  /** h2 — когда ошибка внутри страницы со своим h1 (вкладки кабинета). */
  titleAs?: 'h1' | 'h2';
};

export default function ErrorState({
  code = 500,
  title,
  description,
  message,
  onReset,
  titleAs: Title = 'h1',
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
    <div className="flex items-center justify-center px-4 py-12 sm:py-16">
      <Card padding="lg" className="w-full max-w-2xl text-center">
        <p className="text-5xl font-bold text-sky-700 sm:text-9xl">{code}</p>
        <Title className={`mt-3 ${PAGE_TITLE}`}>{displayTitle}</Title>
        <p className="mt-2 text-sm text-slate-600 sm:text-base">{displayDescription}</p>
        {/* {message && (
          <p className="mt-2 text-xs text-red-500 sm:text-sm">{message}</p>
        )} */}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 ">
          {onReset && <Button onClick={onReset}>Попробовать снова</Button>}
          <Link href="/" className={buttonClass(onReset ? 'secondary' : 'primary')}>
            На главную
          </Link>
        </div>
      </Card>
    </div>
  );
}
