'use client';

import { useMySession } from '@/context/AuthContext';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import PageContainer from '@/components/layout/PageContainer';

export default function Main() {
  const { loading, user } = useMySession();
  if (loading) {
      return (
        <div className="loader-container">
          <p>Загрузка сессии...</p>
        </div>
      );
    }
    
  // Авторизованных уводим сразу в их кабинет: рейтинг закрыт от студентов
  // и живёт вкладкой в /staff-profile.
  if (user?.isAuthenticated === true) {redirect(user.is_employee ? "/staff-profile" : "/profile")}
  return (
    <PageContainer className="my-auto">
      <div className="mx-auto flex max-w-300 flex-col gap-6 rounded-2xl bg-white/90 p-6 shadow-sm items-center lg:flex-row md:gap-8 md:px-10 md:py-8">
        {/* Левая колонка с описанием */}
        <div className="flex-1 space-y-4">
          <p className="text-xl bold font-semibold text-slate-900 sm:text-2xl md:text-3xl">
            Авторизация пользователя
          </p>

          <div className="flex items-center gap-4 pb-4 md:gap-6">
            <Image
              src="/media/logo_BGITU.svg"
              alt="БГИТУ"
              width={80}
              height={80}
              className="h-20 w-auto object-contain md:h-24 dark:invert dark:hue-rotate-180"
            />
            <p className="text-xs font-semibold text-sky-700 md:text-base sm:text-sm">
              БРЯНСКИЙ ГОСУДАРСТВЕННЫЙ <br />
              ИНЖЕНЕРНО-ТЕХНОЛОГИЧЕСКИЙ <br />
              УНИВЕРСИТЕТ — ВЫСШЕЕ УЧЕБНОЕ <br />
              ЗАВЕДЕНИЕ БРЯНСКА.
            </p>
          </div>

          <p className="text-xs text-slate-700 md:text-base sm:text-sm">
            «Портфолио БГИТУ» - система для автоматизации учёта достижений студентов. <br />
            Данный сайт представляет собой Web-расширение информационной системы БГИТУ, <br />
            созданное для студентов и сотрудников университета.
          </p>
          {/* <p className="text-xs text-slate-700 md:text-base sm:text-sm">
            email:{' '}
            <Link
              className="text-sky-700 underline underline-offset-2 hover:text-sky-900"
              href="mailto:oi@bgitu.ru"
            >
              oi@bgitu.ru
            </Link>
          </p> */}
        </div>

        {/* Правая колонка с действиями */}
        <div className="flex w-full max-w-xs flex-col items-stretch justify-center gap-3 rounded-2xl bg-slate-50 px-5 py-6 shadow-sm md:max-w-sm">

          <button className="cursor-pointer w-full rounded-md bg-sky-700 text-sm font-semibold text-white transition hover:bg-sky-900">
            <Link href="/login" className="block w-full text-center px-4 py-3">
              Войти
            </Link>
          </button>

          <button className="cursor-pointer w-full rounded-md bg-sky-100 text-sm font-semibold text-sky-900 transition hover:bg-sky-200">
            <Link href="/reset-password?mode=register" className="block w-full text-center px-4 py-3">
              Зарегистрироваться
            </Link>
          </button>

          {/* <button className="cursor-pointer mt-1 text-center text-xs text-sky-700 underline underline-offset-2 hover:text-sky-800">
            <Link href="/reset-password">
              Восстановить пароль
            </Link>
          </button> */}
        </div>
      </div>
    </PageContainer>
  );
}