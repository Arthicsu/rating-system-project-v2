'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import StudentProfile from '@/components/StudentProfile';
import type { Profile } from '@/interfaces/ProfileInterfaces';

export default function ProfilePage() {
  const router = useRouter();
  const params = useParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const id = params.id as string;

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get(`/student/api/v1/profile/${id}/`);
        const profileData = res.data as Profile;
        
        if (profileData.type === 'staff') {
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
    
    if (id) {
      fetchProfile();
    }
  }, [id, router]);

  if (isLoading) {
    return <div className="p-10 text-center">Загрузка профиля...</div>;
  }
  
  if (!profile) {
    return <div className="p-10 text-center">Данный профиль не найден.</div>;
  }

  return <StudentProfile profile={profile} isOwner={profile.is_own_profile} />;
}