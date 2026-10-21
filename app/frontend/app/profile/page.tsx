'use client';

import { useEffect } from 'react';
import toast from 'react-hot-toast';

import StudentProfile from '@/app/profile/_components/StudentProfile';
import { useMySession } from '@/context/AuthContext';
import { useMyProfile } from '@/hooks/queries';
import { useRedirectIfStaff } from '@/hooks/useRedirectIfStaff';

export default function ProfilePage() {
  // Сотрудника узнаём по сессии (is_employee): /students/me/ отвечает ему 404, роли в ответе нет.
  // Пока сессия грузится, профиль не запрашиваем - иначе сотрудник увидел бы тост с этой 404.
  const { user, loading: sessionLoading } = useMySession();
  const isEmployee = !!user?.is_employee;
  const { data: profile, isPending, error } = useMyProfile(!sessionLoading && !isEmployee);
  useRedirectIfStaff(isEmployee);

  useEffect(() => {
    if (error) toast.error('Ошибка: ' + error);
  }, [error]);

  // Выключенный запрос тоже isPending: скелетон и на время загрузки сессии, и до редиректа сотрудника.
  if (isPending) {
    // StudentProfile в режиме loading рисует скелетон: кости boneyard,
    // до гидрации ручной pulse.
    return <StudentProfile profile={null} isOwner={false} loading />;
  }

  if (!profile) {
    return <div className="p-10 text-center">Данный профиль не найден.</div>;
  }

  return <StudentProfile profile={profile} isOwner={profile.is_own_profile} />;
}
