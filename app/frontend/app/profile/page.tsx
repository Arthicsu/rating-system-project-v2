'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

import StudentProfile from '@/app/profile/_components/StudentProfile';
import { useMySession } from '@/context/AuthContext';
import { useMyProfile } from '@/hooks/queries';
import { useRedirectIfStaff } from '@/hooks/useRedirectIfStaff';

export default function ProfilePage() {
  // Профиль запрашивается только для вошедшего студента. Сотрудника узнаём по сессии
  // (is_employee): /students/me/ отвечает ему 404. Без сессии запрос получил бы 403, и
  // интерсептор принял бы обычный «Выйти» за истёкшую сессию (/login?expired=1).
  const { user, loading: sessionLoading } = useMySession();
  const router = useRouter();
  const isEmployee = !!user?.is_employee;
  const { data: profile, isPending, error } = useMyProfile(!!user && !isEmployee);
  useRedirectIfStaff(isEmployee);

  useEffect(() => {
    // Сессии нет (кука осталась, а сессия погасла) - на вход, как в guard'е кабинета сотрудника.
    if (!sessionLoading && !user) router.replace('/login');
  }, [sessionLoading, user, router]);

  useEffect(() => {
    if (error) toast.error('Ошибка: ' + error);
  }, [error]);

  // Выключенный запрос тоже isPending: скелетон, пока грузится сессия и до любого редиректа.
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
