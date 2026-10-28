'use client';
import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';

import { POLICY_DOCUMENTS } from '@/components/DocumentPage';

const COOKIE_NAME = 'users_cookie_accepted';
const emptySubscribe = () => () => {};

function hasConsent() {
  return document.cookie.split('; ').some((row) => row.startsWith(`${COOKIE_NAME}=`));
}

export default function CookieConsentBanner() {
  const [accepted, setAccepted] = useState(false);
  // Рендерим только на клиенте, чтобы избежать несовпадения гидрации.
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  if (!mounted || accepted || hasConsent()) return null;

  const accept = () => {
    document.cookie = `${COOKIE_NAME}=true; max-age=31536000; path=/; samesite=lax`;
    setAccepted(true);
  };

  // z-30: над шапкой и нижней навигацией (z-20), но под модалками (z-40/z-50) -
  // иначе на телефоне баннер закрывал кнопки модалок до нажатия «Принять».
  // Баннер тёмный в обеих темах, поэтому цвета заданы явно, а не классами палитры.
  return (
    <div className="fixed right-4 bottom-20 left-4 z-30 flex flex-row items-center justify-between gap-6 m-2.5 p-5 px-6 rounded-lg bg-[#2b2b2b] text-white shadow-[0_8px_32px_rgba(0,0,0,0.24)] sm:bottom-4 max-md:flex-col max-md:items-stretch max-md:gap-4">
      <div className="flex-1 m-0 text-[13px] leading-relaxed text-white">
        <p className="m-0">
          Для работы сайта мы используем файлы cookie и обрабатываем персональные данные. Продолжая
          пользоваться сайтом, вы подтверждаете и принимаете:
        </p>
        <ul className="mt-1 flex flex-col sm:flex-row sm:flex-wrap sm:gap-x-4">
          {POLICY_DOCUMENTS.map((doc) => (
            <li key={doc.href}>
              <Link
                href={doc.href}
                className="inline-flex min-h-8 items-center underline underline-offset-2 hover:opacity-80 sm:min-h-0"
              >
                {doc.title}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex-shrink-0 m-0 max-md:flex max-md:justify-center">
        <button
          type="button"
          onClick={accept}
          className="m-0 py-2.5 px-8 border-0 rounded-md bg-[#fff] text-[#1c4973] text-sm font-medium leading-tight whitespace-nowrap cursor-pointer transition-colors duration-200 ease-in-out hover:bg-[#f0f0f0]"
        >
          Принять
        </button>
      </div>
    </div>
  );
}
