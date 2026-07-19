'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';
import { useMySession } from '@/context/AuthContext';
import { usePendingCount } from '@/hooks/queries';

type NavItem = {
  href: string;
  label: string;
  icon: string;
  /** tab - значение ?tab= текущего URL: ссылка «Заявки» ведёт на конкретную вкладку /staff-profile. */
  isActive: (path: string, tab: string | null) => boolean;
  cta?: boolean;
  badge?: number;
};

export default function Header() {
  const { logoutUser, user, loading } = useMySession();
  const pathname = usePathname() ?? '';
  const { data: pendingCount } = usePendingCount(!!user?.is_staff);

  const profileHref = user?.is_staff ? '/staff-profile' : '/profile';

  // В меню только то, чего нет по клику на имя (кабинет): у сотрудника прямая
  // ссылка на заявки, у студента кнопка загрузки достижения.
  const navItems: NavItem[] = !user
    ? []
    : user.is_staff
      ? [
          {
            href: '/staff-profile?tab=pending-requests',
            label: 'Заявки',
            icon: 'fa-solid fa-inbox',
            isActive: (p, tab) => p.startsWith('/staff-profile') && tab === 'pending-requests',
            badge: pendingCount ?? 0,
          },
        ]
      : [
          { href: '/upload-achievement', label: 'Загрузить', icon: 'fa-solid fa-circle-plus', isActive: (p) => p.startsWith('/upload-achievement'), cta: true },
        ];

  return (
    <>
      {/* Верхняя шапка */}
      <header className="fixed inset-x-0 top-0 z-20 w-full bg-white shadow-[0px_20px_40px_-10px_rgba(34,60,80,0.15)]">
        <div className="mx-auto max-w-350 px-4 sm:px-5">
          <div className="flex items-center justify-between gap-3 py-2 sm:py-2.5">
            {/* Лого + основная навигация (ПК) */}
            <div className="flex min-w-0 items-center gap-4 sm:gap-6">
              <Link href="/" className="flex shrink-0 items-center" aria-label="На главную">
                <Image
                  src="/media/logo_BGITU.svg"
                  alt="БГИТУ"
                  width={40}
                  height={40}
                  priority
                  className="h-10 w-auto sm:h-12 object-contain"
                />
              </Link>

              <nav className="hidden items-center gap-1 sm:flex">
                {/* useSearchParams требует Suspense при пререндере; до логина элементов всё равно нет. */}
                <Suspense fallback={null}>
                  <DesktopNavLinks items={navItems} pathname={pathname} />
                </Suspense>
              </nav>
            </div>

            {/* Внешние системы + пользователь */}
            <div className="flex shrink-0 items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-2 border-r border-slate-200 pr-2 sm:gap-3 sm:pr-4">
                <a
                  href="https://eos.bgitu.ru/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-slate-500 hover:text-sky-700 sm:text-sm"
                >
                  ЭОС
                </a>
                <a
                  href="https://it.bgitu.ru/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center"
                  aria-label="IT-портал БГИТУ"
                >
                  <Image src="/media/logo_IT.png" alt="IT" width={32} height={32} className="h-7 w-7 object-contain sm:h-8 sm:w-8" />
                </a>
              </div>

              {loading ? (
                <span className="h-4 w-16 animate-pulse rounded bg-slate-200" />
              ) : user ? (
                <div className="flex items-center gap-2 text-xs text-slate-600 sm:gap-3 sm:text-sm">
                  <Link
                    href={profileHref}
                    className="inline-flex max-w-32 items-center gap-1.5 truncate hover:text-sky-700 sm:max-w-none"
                  >
                    <span className="inline truncate sm:hidden">{user.short_name}</span>
                    <span className="hidden truncate sm:inline">{user.full_name}</span>
                  </Link>
                  <button
                    onClick={logoutUser}
                    className="cursor-pointer inline-flex items-center whitespace-nowrap border-0 bg-transparent px-1 text-xs text-sky-600 hover:text-sky-700 sm:text-sm"
                  >
                    Выйти
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="whitespace-nowrap rounded-md bg-sky-700 px-4 py-2 text-xs font-medium text-white transition hover:bg-sky-800 sm:text-sm"
                >
                  Войти
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Нижний таб-бар (мобилки) */}
      {navItems.length > 0 && (
        <nav
          className="fixed inset-x-0 bottom-0 z-20 grid border-t border-slate-200 bg-white sm:hidden"
          style={{
            gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))`,
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          <Suspense fallback={null}>
            <MobileNavLinks items={navItems} pathname={pathname} />
          </Suspense>
        </nav>
      )}
    </>
  );
}

/** Ссылки верхней навигации (ПК); подсветка учитывает и путь, и вкладку ?tab=. */
function DesktopNavLinks({ items, pathname }: { items: NavItem[]; pathname: string }) {
  const tab = useSearchParams().get('tab');

  return items.map((item) => {
    const active = item.isActive(pathname, tab);
    if (item.cta) {
      return (
        <Link
          key={item.href}
          href={item.href}
          className="ml-1 inline-flex items-center gap-2 rounded-md bg-sky-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-800"
        >
          <i className={item.icon} aria-hidden="true" />
          {item.label}
        </Link>
      );
    }
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? 'page' : undefined}
        className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm transition ${
          active ? 'bg-slate-100 font-medium text-sky-700' : 'text-slate-600 hover:bg-slate-100 hover:text-sky-700'
        }`}
      >
        <i className={item.icon} aria-hidden="true" />
        {item.label}
        {!!item.badge && item.badge > 0 && (
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[11px] font-semibold leading-tight text-white">
            {item.badge}
          </span>
        )}
      </Link>
    );
  });
}

/** Ссылки нижнего таб-бара (мобилки); подсветка та же, что и наверху. */
function MobileNavLinks({ items, pathname }: { items: NavItem[]; pathname: string }) {
  const tab = useSearchParams().get('tab');

  return items.map((item) => {
    const active = item.isActive(pathname, tab);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? 'page' : undefined}
        className={`relative flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] transition ${
          active || item.cta ? 'text-sky-700' : 'text-slate-500'
        }`}
      >
        <i className={`${item.icon} text-lg`} aria-hidden="true" />
        <span>{item.label}</span>
        {!!item.badge && item.badge > 0 && (
          <span className="absolute left-1/2 top-1 ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[10px] font-semibold leading-tight text-white">
            {item.badge}
          </span>
        )}
      </Link>
    );
  });
}
