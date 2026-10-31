'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import CountBadge from '@/components/CountBadge';
import { useMySession } from '@/context/AuthContext';
import { usePendingCount } from '@/hooks/queries';

export type Section = {
  href: string;
  label: string;
  icon: string;
  /** tab - значение ?tab= текущего URL: «Заявки» ведут на конкретную вкладку /staff-profile. */
  isActive: (path: string, tab: string | null) => boolean;
  cta?: boolean;
  badge?: number;
  badgeTone?: 'alert' | 'neutral';
};

/** Главный раздел роли: студенту - загрузка достижения, сотруднику - заявки. */
export function useMainSection(): Section | null {
  const { user } = useMySession();
  const { data: pendingCount } = usePendingCount(!!user?.is_employee);
  if (!user) return null;
  if (!user.is_employee) {
    return {
      href: '/upload-achievement',
      label: 'Загрузить',
      icon: 'fa-solid fa-circle-plus',
      isActive: (p) => p.startsWith('/upload-achievement'),
      cta: true,
    };
  }
  // Руководство заявки не одобряет, а контролирует подтверждённые кафедрой (вариант А):
  // у него «На контроле» и нейтральный счётчик, а не красный «требует действия».
  const isLeadership = user.roles.some((r) => r === 'Dean' || r === 'Rectorate');
  return {
    href: '/staff-profile?tab=pending-requests',
    label: isLeadership ? 'На контроле' : 'Заявки',
    icon: 'fa-solid fa-inbox',
    isActive: (p, tab) => p.startsWith('/staff-profile') && tab === 'pending-requests',
    badge: pendingCount?.pending_docs_count ?? 0,
    badgeTone: isLeadership ? 'neutral' : 'alert',
  };
}

/** Главный раздел в шапке (ПК); на телефоне он в нижней панели. */
export default function MainNav() {
  const section = useMainSection();
  if (!section) return null;
  return (
    <nav aria-label="Главный раздел" className="hidden items-center sm:flex">
      {/* useSearchParams требует Suspense при пререндере. */}
      <Suspense fallback={null}>
        <MainNavLink section={section} />
      </Suspense>
    </nav>
  );
}

function MainNavLink({ section }: { section: Section }) {
  const pathname = usePathname() ?? '';
  const tab = useSearchParams().get('tab');
  const active = section.isActive(pathname, tab);
  const look = section.cta
    ? 'bg-sky-700 px-4 font-medium text-white hover:bg-sky-800'
    : active
      ? 'bg-slate-100 px-3 font-medium text-sky-700'
      : 'px-3 text-slate-600 hover:bg-slate-100 hover:text-sky-700';
  return (
    <Link
      href={section.href}
      aria-current={active ? 'page' : undefined}
      className={`inline-flex min-h-11 items-center gap-2 rounded-md text-sm transition ${look}`}
    >
      <i className={section.icon} aria-hidden="true" />
      {section.label}
      <CountBadge count={section.badge ?? 0} tone={section.badgeTone} />
    </Link>
  );
}
