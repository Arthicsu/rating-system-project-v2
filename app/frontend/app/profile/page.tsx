'use client';

import api from '@/lib/axios';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

import StudentProfile from '@/components/StudentProfile';
import type { Profile } from '@/interfaces/ProfileInterfaces';

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get('/student/api/v1/profile/');
        const profileData: Profile = res.data;
        
        if (profileData.is_staff) {
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