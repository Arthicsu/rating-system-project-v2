'use client';

import Link from 'next/link';

export default function ErrorState({
  code = 500,
  title = 'Произошла ошибка',
  description = 'Попробуйте обновить страницу или вернуться на главную.'
}) {
  return (
    <main className="flex min-h-[70vh] items-center justify-items-center px-5 pt-25">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 text-center shadow-[0_6px_20px_rgba(0,0,0,0.08)] sm:p-8">
        <p className="text-5xl font-bold text-sky-700 sm:text-9xl">{code}</p>
        <h1 className="mt-3 text-xl font-semibold text-slate-800 sm:text-2xl">{title}</h1>
        <p className="mt-2 text-sm text-slate-600 sm:text-base">{description}</p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 ">
          <Link
            href="/"
            className="inline-flex items-center rounded-md bg-sky-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-800"
          >
            На главную
          </Link>
        </div>
      </div>
    </main>
  );
}
