'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import { useMySession } from '@/context/AuthContext';

export default function Header() {
  const { logoutUser, user } = useMySession();
  const [pendingCount, setPendingCount] = useState(0);
  const [isStaff, setIsStaff] = useState(false);

  useEffect(() => {
    if (!user || !user.isAuthenticated) {
      setIsStaff(false);
      setPendingCount(0);
      return;
    }

    let cancelled = false;

    api
      .get('/user/api/v1/profile/')
      .then((res) => {
        if (cancelled) return;
        const profileType = res.data?.type;
        const staff = profileType === 'staff';
        setIsStaff(staff);

        const list = staff ? res.data?.pending_documents : null;
        setPendingCount(Array.isArray(list) ? list.length : 0);
      })
      .catch(() => {
        if (!cancelled) {
          setIsStaff(false);
          setPendingCount(0);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <header className="fixed inset-x-0 top-0 z-20 w-full bg-white shadow-[0_4px_4px_rgba(0,0,0,0.589)]">
      <div className="mx-auto max-w-350 px-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3 py-2 sm:py-2.5">
          {/* Логотип + хлебные крошки */}
          <div className="flex min-w-0 items-center gap-3 sm:gap-6.5">
            <Link href="/">
              <img
                src="/media/logo_BGITU.png"
                alt="БГИТУ"
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
            </div>
          </div>

          {/* Правая часть: IT-логотип + пользователь/кнопки */}
          <div className="flex flex-1 items-center justify-end gap-3 sm:gap-6 min-w-0">
            <a
              href="#"
              className="items-center border-x border-[rgba(211,215,225,0.6)] px-3 sm:px-5 mr-1 sm:mr-3"
            >
              <img
                src="/media/logo_IT.png"
                alt="IT"
                className="h-8 w-8 sm:h-10 sm:w-10 object-contain"
              />
            </a>

            <div className="flex items-center gap-3 text-xs sm:text-[14px] leading-[1.43] text-[#6a7a98]">
              {user ? (
                <>
                  <Link
                    href="/profile"
                    className="inline-flex max-w-45 sm:max-w-none items-center gap-1.5 truncate hover:underline"
                  >
                    <span className="truncate">{user.full_name}</span>
                    {isStaff && pendingCount > 0 && (
                      <span className="ml-1 inline-flex min-w-4.5 items-center justify-center rounded-full bg-rose-600 px-1.5 text-[11px] font-semibold leading-tight text-white">
                        {pendingCount}
                      </span>
                    )}
                  </Link>
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