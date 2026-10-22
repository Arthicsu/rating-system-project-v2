'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import type { AxiosError } from 'axios';

import StudentProfile from '@/app/profile/_components/StudentProfile';
import { useMySession } from '@/context/AuthContext';
import { useProfileById } from '@/hooks/queries';
import { useRedirectIfLoggedOut } from '@/hooks/useRedirectIfLoggedOut';
import { useRedirectIfStaff } from '@/hooks/useRedirectIfStaff';
import type { Profile } from '@/interfaces/ProfileInterfaces';
import { apiErrorMessage, isAuthError } from '@/lib/apiError';

export default function ProfilePage() {
  const params = useParams();
  const id = params.id as string;

  // Без сессии профиль не запрашиваем (иначе 403 после «Выйти»); пока идёт редирект - скелетон.
  const { user } = useMySession();
  useRedirectIfLoggedOut(`/profile/${id}`);
  const { data: profile, isPending, error } = useProfileById(id, !!user);

  useEffect(() => {
    if (error && !isAuthError(error)) toast.error(apiErrorMessage(error, 'Не удалось загрузить профиль'));
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
    // 403 при живой сессии - студент вне области видимости (погасшую сессию уводит на вход интерсептор).
    const forbidden = (error as AxiosError | null)?.response?.status === 403;
    return (
      <div className="p-10 text-center">
        {forbidden ? 'Нет доступа к этому профилю.' : 'Данный профиль не найден.'}
      </div>
    );
  }

  return <StudentProfile profile={profile} isOwner={profile.is_own_profile} />;
}
