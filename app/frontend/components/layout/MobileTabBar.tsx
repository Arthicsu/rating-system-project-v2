'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import CountBadge from '@/components/CountBadge';
import { useMySession } from '@/context/AuthContext';
import { useMainSection, type Section } from '@/components/layout/MainNav';

/** Нижняя панель телефона: только главные разделы роли; настройки и выход - в меню пользователя. */
export default function MobileTabBar() {
  const { user } = useMySession();
  const main = useMainSection();
  if (!user || !main) return null;

  const home: Section = user.is_employee
    ? {
        href: '/staff-profile',
        label: 'Кабинет',
        icon: 'fa-solid fa-briefcase',
        isActive: (p, tab) => p.startsWith('/staff-profile') && tab !== 'pending-requests',
      }
    : { href: '/profile', label: 'Профиль', icon: 'fa-solid fa-user', isActive: (p) => p.startsWith('/profile') };

  return (
    <nav
      aria-label="Разделы"
      className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-2 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      {/* useSearchParams требует Suspense при пререндере. */}
      <Suspense fallback={null}>
        <TabLinks items={[home, main]} />
      </Suspense>
    </nav>
  );
}

function TabLinks({ items }: { items: Section[] }) {
  const pathname = usePathname() ?? '';
  const tab = useSearchParams().get('tab');

  return items.map((item) => {
    const active = item.isActive(pathname, tab);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? 'page' : undefined}
        className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 py-1.5 text-xs transition-[color,scale] duration-150 active:scale-95 motion-reduce:transition-none ${
          active ? 'font-medium text-sky-700' : 'text-slate-500'
        }`}
      >
        <span className="relative flex h-8 w-16 items-center justify-center">
          {/* Подложка активного раздела раскрывается от центра при переходе. */}
          <span
            aria-hidden="true"
            className={`absolute inset-0 rounded-full bg-sky-100 transition-[opacity,scale] duration-200 ease-out motion-reduce:transition-none ${
              active ? 'scale-x-100 opacity-100' : 'scale-x-50 opacity-0'
            }`}
          />
          <i className={`relative ${item.icon} text-lg`} aria-hidden="true" />
        </span>
        <span>{item.label}</span>
        <CountBadge count={item.badge ?? 0} tone={item.badgeTone} className="absolute left-1/2 top-1 ml-1.5" />
      </Link>
    );
  });
}
