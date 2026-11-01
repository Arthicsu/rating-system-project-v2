'use client';

import { useMySession } from '@/context/AuthContext';
import { useRedirectIfLoggedOut } from '@/hooks/useRedirectIfLoggedOut';
import PageContainer from '@/components/layout/PageContainer';
import UploadAchievementForm from './_components/UploadAchievementForm';
import UploadFormSkeleton from './_components/UploadFormSkeleton';

/**
 * Страница загрузки достижения: гварды авторизации, сама форма -
 * в ./_components/UploadAchievementForm (react-hook-form + zod).
 */
export default function UploadAchievement() {
  const { user, loading: authLoading } = useMySession();
  useRedirectIfLoggedOut('/upload-achievement');

  // Без сессии - тот же скелетон, пока useRedirectIfLoggedOut уводит на вход.
  if (authLoading || !user) {
    return (
      <PageContainer>
        <UploadFormSkeleton withHeader />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <UploadAchievementForm user={user} />
    </PageContainer>
  );
}
