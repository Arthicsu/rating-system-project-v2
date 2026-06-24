'use client';

import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

import { studentApi } from '@/lib/apiRequests';
import StudentProfile from '@/components/StudentProfile';
import type { Profile } from '@/interfaces/ProfileInterfaces';

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const fetchProfile = useCallback(() => {
    return studentApi.getProfile()
      .then(res => {
        const profileData = res.data;
        if (profileData.is_staff) {
          router.push('/staff-profile');
          return;
        }
        setProfile(profileData);
      })
      .catch(error => toast.error('Ошибка: ' + error))
      .finally(() => setIsLoading(false));
  }, [router]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  if (isLoading) {
    return <div className="p-10 text-center">Загрузка профиля...</div>;
  }

  if (!profile) {
    return <div className="p-10 text-center">Данный профиль не найден.</div>;
  }

  return <StudentProfile profile={profile} isOwner={profile.is_own_profile} onRefresh={fetchProfile} />;
}