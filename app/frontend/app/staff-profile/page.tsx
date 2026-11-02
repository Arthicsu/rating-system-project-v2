'use client';

import { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { useMySession } from '@/context/AuthContext';
import { useRedirectIfLoggedOut } from '@/hooks/useRedirectIfLoggedOut';

import StaffDashboard from './_components/StaffDashboard';

/**
 * Guard кабинета сотрудника: пока роль не подтверждена — не рендерим и не
 * выполняем НИ ОДНОГО хука кабинета (StaffDashboard не монтируется вовсе).
 *
 * Это убирает мигание staff-интерфейса у студента/анонима и не даёт странице
 * стрелять staff-запросами от чужого имени. Сама защита данных — на backend
 * (IsStaffProfile/CanReviewDocument, покрыто тестами): даже остановив рендер
 * через DevTools, не-сотрудник получит 403 на любой staff-ручке.
 */
export default function StaffProfilePage() {
  const { user, loading } = useMySession();
  const router = useRouter();
  useRedirectIfLoggedOut('/staff-profile');

  useEffect(() => {
    if (user && !user.is_employee) router.replace('/profile');
  }, [user, router]);

  if (loading || !user?.is_employee) {
    return null;
  }

  // useSearchParams в кабинете требует Suspense; кабинет и так рендерится только на клиенте.
  return (
    <Suspense fallback={null}>
      <StaffDashboard />
    </Suspense>
  );
}
