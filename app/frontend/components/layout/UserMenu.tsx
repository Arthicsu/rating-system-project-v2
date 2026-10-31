'use client';

import Link from 'next/link';
import HeaderPopover from '@/components/layout/HeaderPopover';
import { initials, roleLabel } from '@/components/layout/userLabels';
import { useMySession } from '@/context/AuthContext';

const ITEM = 'flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-left text-sm transition';
const LINK = `${ITEM} text-slate-700 hover:bg-slate-100 hover:text-slate-900`;
const ICON = 'w-4 shrink-0 text-center text-slate-500';

/** Кнопка с именем и меню пользователя: профиль или кабинет, настройки, ЭОС (телефон), выход. */
export default function UserMenu() {
  const { user, logoutUser } = useMySession();
  if (!user) return null;

  const home = user.is_employee
    ? { href: '/staff-profile', label: 'Кабинет', icon: 'fa-solid fa-briefcase' }
    : { href: '/profile', label: 'Профиль', icon: 'fa-solid fa-user' };

  return (
    <HeaderPopover
      id="user-menu"
      // Видимое имя входит в подпись: голосовое управление находит кнопку по тому, что на ней написано.
      label={`Меню пользователя ${user.short_name}`}
      buttonClassName="group inline-flex min-h-11 min-w-0 cursor-pointer items-center gap-2 rounded-full px-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 aria-expanded:bg-slate-100 sm:max-w-56 sm:px-3"
      panelClassName="sm:w-72"
      button={
        <>
          <span className="hidden min-w-0 truncate sm:inline">{user.short_name}</span>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sky-700 text-xs font-semibold text-white sm:hidden">
            {initials(user.full_name)}
          </span>
          <i
            className="fa-solid fa-chevron-down shrink-0 text-xs text-slate-500 transition-transform duration-200 group-aria-expanded:rotate-180 motion-reduce:transition-none"
            aria-hidden="true"
          />
        </>
      }
    >
      <div className="px-3 pt-1 pb-2">
        <p className="truncate text-sm font-semibold text-slate-900">{user.full_name}</p>
        <p className="truncate text-xs text-slate-500">{roleLabel(user)}</p>
      </div>
      <hr className="my-1 border-slate-200" />
      <Link href={home.href} className={LINK}>
        <i className={`${home.icon} ${ICON}`} aria-hidden="true" />
        {home.label}
      </Link>
      <Link href="/settings" className={LINK}>
        <i className={`fa-solid fa-gear ${ICON}`} aria-hidden="true" />
        Настройки
      </Link>
      <a href="https://eos.bgitu.ru/" target="_blank" rel="noopener noreferrer" className={`${LINK} sm:hidden`}>
        <i className={`fa-solid fa-graduation-cap ${ICON}`} aria-hidden="true" />
        ЭОС
      </a>
      <hr className="my-1 border-slate-200" />
      <button type="button" onClick={logoutUser} className={`${ITEM} text-rose-600 hover:bg-rose-50 hover:text-rose-700`}>
        <i className="fa-solid fa-arrow-right-from-bracket w-4 shrink-0 text-center" aria-hidden="true" />
        Выйти
      </button>
    </HeaderPopover>
  );
}
