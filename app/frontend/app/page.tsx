'use client';

import { useMySession } from '@/context/AuthContext';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import PageContainer from '@/components/layout/PageContainer';
import { PAGE_TITLE } from '@/components/layout/PageHeader';
import { buttonClass } from '@/components/Button';
import Card, { PANEL } from '@/components/Card';
import Spinner from '@/components/Spinner';

export default function Main() {
  const { loading, user } = useMySession();
  if (loading) {
      return (
        <PageContainer className="my-auto flex justify-center">
          <Spinner label="Загрузка сессии…" />
        </PageContainer>
      );
    }
    
  // Авторизованных уводим сразу в их кабинет: рейтинг закрыт от студентов
  // и живёт вкладкой в /staff-profile.
  if (user?.isAuthenticated === true) {redirect(user.is_employee ? "/staff-profile" : "/profile")}
  return (
    <PageContainer className="my-auto">
      <Card padding="lg" className="mx-auto flex max-w-300 flex-col items-center gap-6 md:gap-8 lg:flex-row">
        {/* Левая колонка с описанием */}
        <div className="flex-1 space-y-4">
          <h1 className={PAGE_TITLE}>Авторизация пользователя</h1>

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
            «Портфолио БГИТУ» - система для автоматизации учёта достижений студентов.
            Данный сайт представляет собой Web-расширение информационной системы БГИТУ,
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
        <div className={`${PANEL} flex w-full max-w-xs flex-col items-stretch justify-center gap-3 md:max-w-sm`}>
          <Link href="/login" className={`${buttonClass()} w-full`}>
            Войти
          </Link>
          <Link href="/reset-password?mode=register" className={`${buttonClass('secondary')} w-full`}>
            Зарегистрироваться
          </Link>

          {/* <button className="cursor-pointer mt-1 text-center text-xs text-sky-700 underline underline-offset-2 hover:text-sky-800">
            <Link href="/reset-password">
              Восстановить пароль
            </Link>
          </button> */}
        </div>
      </Card>
    </PageContainer>
  );
}