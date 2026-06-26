'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useMySession } from '@/context/AuthContext';

export default function Header() {
  const { logoutUser, user, loading } = useMySession();

  return (
    <header className="fixed inset-x-0 top-0 z-20 w-full bg-white shadow-[0px_20px_40px_-10px_rgba(34,60,80,0.15)]">
      <div className="mx-auto max-w-350 px-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3 py-2 sm:py-2.5">
          {/* Логотип + хлебные крошки */}
          <div className="flex min-w-0 items-center gap-3 sm:gap-6.5">
            <Link href="/">
              <Image
                src="/media/logo_BGITU.svg"
                alt="БГИТУ"
                width={40}
                height={40}
                className="h-10 w-auto sm:h-15 sm:w-17.5 object-contain cursor-pointer"
              />
            </Link>
            <div className="flex items-center text-xs sm:text-[14px] leading-[1.43] text-[#d3d7e1]">
              <Link
                href="/"
                className="text-xs sm:text-[14px] leading-[1.43] text-[#6a7a98] hover:underline"
              >
                Главная
              </Link>
              <span className="mx-2 sm:mx-3">/</span>
              <a
                href="https://eos.bgitu.ru/"
                className="text-xs sm:text-[14px] leading-[1.43] text-[#6a7a98] hover:underline"
              >
                ЭОС
              </a>
            </div>
          </div>

          {/* Правая часть: IT-логотип + пользователь/кнопки */}
          <div className="flex flex-1 items-center justify-end gap-3 sm:gap-6 min-w-0">
            <Link
              href="https://it.bgitu.ru/"
              className="items-center border-x border-[rgba(211,215,225,0.6)] px-3 sm:px-5 mr-1 sm:mr-3"
            >
              <Image
                src="/media/logo_IT.png"
                alt="IT"
                width={40}
                height={40}
                className="h-8 w-8 sm:h-10 sm:w-10 object-contain"
              />
            </Link>
            <div className="flex items-center gap-3 text-xs sm:text-[14px] leading-[1.43] text-[#6a7a98]">
              {loading ? (
                <span className="w-16 h-4 bg-gray-200 animate-pulse rounded"></span>
              ) : user ? (
                <>
                  <Link
                    href={user.is_staff ? "/staff-profile" : "/profile"}
                    className="inline-flex max-w-45 sm:max-w-none items-center gap-1.5 truncate hover:underline"
                  >
                    <span className="inline truncate sm:hidden">{user.short_name}</span>
                    <span className="hidden truncate sm:inline">{user.full_name}</span>
                  </Link>
                  {user.is_staff && Number(user.pending_docs_count) > 0 && (
                    <span className="ml-1 inline-flex min-w-4.5 items-center justify-center rounded-full bg-rose-600 px-1.5 text-[11px] font-semibold leading-tight text-white">
                      {user.pending_docs_count}
                    </span>
                  )}
                  <button
                    onClick={logoutUser}
                    className="whitespace-nowrap bg-transparent text-xs sm:text-[14px] leading-[1.43] text-[#6a7a98] hover:underline cursor-pointer border-0"
                  >
                    Выйти
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  className="whitespace-nowrap text-xs sm:text-[14px] leading-[1.43] text-[#6a7a98] hover:underline"
                >
                  Войти
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}