'use client';

import Image from 'next/image';
import Link from 'next/link';
import { buttonClass } from '@/components/Button';
import LowVisionButton from '@/components/layout/LowVisionButton';
import MainNav from '@/components/layout/MainNav';
import { Bone } from '@/components/Skeleton';
import UserMenu from '@/components/layout/UserMenu';
import { useMySession } from '@/context/AuthContext';

/** Шапка: логотип, главный раздел роли, версия для слабовидящих, меню пользователя или вход. */
export default function Header() {
  const { user, loading } = useMySession();

  return (
    // При крупном шрифте для слабовидящих шапка не закреплена и переносится на две строки -
    // иначе пункты наезжают друг на друга и закрывают начало страницы.
    <header className="sticky top-0 z-20 w-full bg-white shadow-[0px_20px_40px_-10px_rgba(34,60,80,0.15)] low-vision:static">
      <div className="mx-auto flex max-w-350 items-center justify-between gap-3 px-4 py-2 sm:px-5 sm:py-2.5 low-vision:flex-wrap">
        <div className="flex min-w-0 items-center gap-4 sm:gap-6">
          <Link href="/" className="flex min-h-11 min-w-11 shrink-0 items-center gap-2.5">
            <Image
              src="/media/logo_BGITU.svg"
              alt="БГИТУ"
              width={40}
              height={40}
              priority
              className="h-10 w-auto object-contain sm:h-12 dark:invert dark:hue-rotate-180"
            />
            <span className="hidden text-base font-semibold text-slate-900 sm:inline">Портфолио</span>
          </Link>
          <MainNav />
        </div>

        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
          {/* <a
            href="https://eos.bgitu.ru/"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden min-h-11 items-center gap-1.5 px-2 text-sm text-slate-600 transition-colors hover:text-sky-700 sm:inline-flex"
          >
            <Image src="/media/logo_EOS.svg" alt="" width={20} height={20} className="size-5 rounded-[25%]" />
            ЭОС
          </a> */}
          <LowVisionButton />
          {loading ? (
            <Bone className="h-11 w-20 rounded-lg" />
          ) : user ? (
            <UserMenu />
          ) : (
            <Link href="/login" className={`${buttonClass()} whitespace-nowrap`}>
              Войти
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
