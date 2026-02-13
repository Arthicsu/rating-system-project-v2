'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/axios';
import Link from "next/link";
import StudentProfile from '@/components/StudentProfile';
import TeacherProfile from '@/components/TeacherProfile';

export default function Profile() {
    const [profile, setProfile] = useState<any>(null);
    const params = useParams();
    const [isLoading, setIsLoading] = useState(false);
    const { id } = useParams();


    useEffect(() => {
        setIsLoading(true);
        api.get(`/user/api/v1/profile/${id}/`) 
            .then(res => setProfile(res.data))
            .catch(err => console.error("Ошибка доступа", err))
            .finally(() => setIsLoading(false));
    }, [params.id]);

    if (isLoading) return <div className="p-10 text-center">Загрузка профиля...</div>;
    if (!profile) return <div className="p-10 text-center">Данный профиль не найден.</div>;
    const isTeacher = profile.is_teacher
    const isOwner = profile.is_own_profile;
    return (
      <>
          {isTeacher ? (
              <TeacherProfile profile={profile} isOwner={isOwner}/>
          ):(
              <StudentProfile profile={profile} isOwner={isOwner}/>
          )}
      </>
    );
}