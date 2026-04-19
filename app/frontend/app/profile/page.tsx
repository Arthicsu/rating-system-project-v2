'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import StudentProfile from '@/components/StudentProfile';
import type { Profile } from '@/interfaces/ProfileInterfaces';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get('/student/api/v1/profile/');
        const profileData: Profile = res.data;
        
        if (profileData.isStaff) {
          router.push('/staff-profile');
          return;
        }
        
        setProfile(profileData);
      } catch (error) {
        toast.error('Ошибка: ' + error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchProfile();
  }, [router]);

  if (isLoading) {
    return <div className="p-10 text-center">Загрузка профиля...</div>;
  }
  
  if (!profile) {
    return <div className="p-10 text-center">Данный профиль не найден.</div>;
  }

  return <StudentProfile profile={profile} isOwner={profile.is_own_profile} />;
}