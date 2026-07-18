'use client';
import { useState, useSyncExternalStore } from 'react';

const COOKIE_NAME = 'users_cookie_accepted';
const emptySubscribe = () => () => {};

function hasConsent() {
  return document.cookie.split('; ').some((row) => row.startsWith(`${COOKIE_NAME}=`));
}

export default function CookieConsentBanner() {
  const [showDetails, setShowDetails] = useState(false);
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

  return (
    <div className="fixed right-4 bottom-20 left-4 z-50 flex flex-row items-center justify-between gap-6 m-2.5 p-5 px-6 rounded-lg bg-[#2b2b2b] text-white shadow-[0_8px_32px_rgba(0,0,0,0.24)] sm:bottom-4 max-md:flex-col max-md:items-stretch max-md:gap-4">
      <div className="flex-1 m-0 text-[13px] leading-relaxed text-white">
        <p className="m-0">
          Нажимая кнопку «Принять», Вы подтверждаете то, что Вы проинформированы об{' '}
          <button
            type="button"
            onClick={() => setShowDetails((prev) => !prev)}
            className="underline cursor-pointer hover:opacity-80"
          >
            использовании cookies
          </button>{' '}
          на нашем сайте.
        </p>

        <div
          className="grid transition-[grid-template-rows] duration-300 ease-in-out"
          style={{ gridTemplateRows: showDetails ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">
            <hr className="my-2.5 border-0 border-t border-dashed border-white/35" />
            <p className="m-0 mb-2">
              Для того, чтобы мы могли качественно предоставить Вам услуги, мы используем
              cookies, которые сохраняются на Вашем компьютере (сведения о местоположении;
              ip-адрес; тип, язык, версия ОС и браузера; тип устройства и разрешение его
              экрана; источник, откуда пришел на сайт пользователь; какие страницы открывает
              и на какие кнопки нажимает пользователь).
            </p>
            <p className="m-0 mt-2">
              Отключить cookies Вы можете в настройках своего браузера.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 m-0 max-md:flex max-md:justify-center">
        <button
          type="button"
          onClick={accept}
          className="m-0 py-2.5 px-8 border-0 rounded-md bg-white text-[#1a3a6b] text-sm font-medium leading-tight whitespace-nowrap cursor-pointer transition-colors duration-200 ease-in-out hover:bg-[#f0f0f0]"
        >
          Принять
        </button>
      </div>
    </div>
  );
}
