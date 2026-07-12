'use client';

import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

import StudentProfile from '@/components/StudentProfile';
import { useMyProfile } from '@/hooks/queries/useProfile';
import type { Profile } from '@/interfaces/ProfileInterfaces';

export default function ProfilePage() {
  const router = useRouter();
  const { data: profile, isPending, error, refetch } = useMyProfile();

  useEffect(() => {
    if (error) toast.error('Ошибка: ' + error);
  }, [error]);

  // Исторический guard: /students/me/ не возвращает is_staff (для сотрудников
  // ручка отвечает 404) — ветка сохранена на случай смены контракта.
  const isStaffProfile = !!profile && !!(profile as Profile & { is_staff?: boolean }).is_staff;
  useEffect(() => {
    if (isStaffProfile) router.push('/staff-profile');
  }, [isStaffProfile, router]);

  if (isPending) {
    // Скелетон профиля вместо текстовой заглушки: StudentProfile в режиме
    // loading рисует кости boneyard (или ручной pulse до гидрации).
    return <StudentProfile profile={null} isOwner={false} loading />;
  }

  if (!profile || isStaffProfile) {
    return <div className="p-10 text-center">Данный профиль не найден.</div>;
  }

  return <StudentProfile profile={profile} isOwner={profile.is_own_profile} onRefresh={() => { refetch(); }} />;
}
