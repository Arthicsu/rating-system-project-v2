'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Редирект сотрудника со студенческих профильных страниц в его кабинет.
 * Само определение «это staff-профиль» остаётся на странице (у /students/me/
 * и /students/<id>/ признаки разные), сюда передаётся готовый boolean.
 */
export function useRedirectIfStaff(isStaffProfile: boolean) {
  const router = useRouter();

  useEffect(() => {
    if (isStaffProfile) router.push('/staff-profile');
  }, [isStaffProfile, router]);
}
