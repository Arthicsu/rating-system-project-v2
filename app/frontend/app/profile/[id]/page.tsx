'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';

import StudentProfile from '@/app/profile/_components/StudentProfile';
import { useProfileById } from '@/hooks/queries/useProfile';
import { useRedirectIfStaff } from '@/hooks/useRedirectIfStaff';
import type { Profile } from '@/interfaces/ProfileInterfaces';

export default function ProfilePage() {
  const params = useParams();
  const id = params.id as string;

  const { data: profile, isPending, error } = useProfileById(id);

  useEffect(() => {
    if (error) toast.error('Ошибка: ' + error);
  }, [error]);

  // Исторический guard: /students/<id>/ не возвращает type (это всегда студент) —
  // ветка сохранена на случай смены контракта.
  const isStaffProfile = !!profile && (profile as Profile & { type?: string }).type === 'staff';
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
