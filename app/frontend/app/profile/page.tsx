'use client';

import { useEffect } from 'react';
import toast from 'react-hot-toast';

import StudentProfile from '@/app/profile/_components/StudentProfile';
import { useMyProfile } from '@/hooks/queries/useProfile';
import { useRedirectIfStaff } from '@/hooks/useRedirectIfStaff';
import type { Profile } from '@/interfaces/ProfileInterfaces';

export default function ProfilePage() {
  const { data: profile, isPending, error } = useMyProfile();

  useEffect(() => {
    if (error) toast.error('Ошибка: ' + error);
  }, [error]);

  // Исторический guard: /students/me/ не возвращает is_staff (для сотрудников
  // ручка отвечает 404) — ветка сохранена на случай смены контракта.
  const isStaffProfile = !!profile && !!(profile as Profile & { is_staff?: boolean }).is_staff;
  useRedirectIfStaff(isStaffProfile);

  if (isPending) {
    // StudentProfile в режиме loading рисует скелетон: кости boneyard,
    // до гидрации ручной pulse.
    return <StudentProfile profile={null} isOwner={false} loading />;
  }

  if (!profile || isStaffProfile) {
    return <div className="p-10 text-center">Данный профиль не найден.</div>;
  }

  return <StudentProfile profile={profile} isOwner={profile.is_own_profile} />;
}
