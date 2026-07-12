'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

import StudentProfile from '@/components/StudentProfile';
import { useProfileById } from '@/hooks/queries/useProfile';
import type { Profile } from '@/interfaces/ProfileInterfaces';

export default function ProfilePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { data: profile, isPending, error } = useProfileById(id);

  useEffect(() => {
    if (error) toast.error('Ошибка: ' + error);
  }, [error]);

  // Исторический guard: /students/<id>/ не возвращает type (это всегда студент) —
  // ветка сохранена на случай смены контракта.
  const isStaffProfile = !!profile && (profile as Profile & { type?: string }).type === 'staff';
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

  return <StudentProfile profile={profile} isOwner={profile.is_own_profile} />;
}
