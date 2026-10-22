'use client';

import { useMySession } from '@/context/AuthContext';
import { useRedirectIfLoggedOut } from '@/hooks/useRedirectIfLoggedOut';
import { Skeleton } from 'boneyard-js/react';
import UploadAchievementForm from './_components/UploadAchievementForm';

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
      <section className="min-h-screen bg-slate-50 pt-24 pb-10">
        <div className="mx-auto max-w-350 px-4 sm:px-5">
          <Skeleton name="upload-form" loading={false}>
            <div className="grid gap-6 rounded-2xl border border-slate-100 bg-white p-4 sm:p-5 animate-pulse">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="h-4 w-32 rounded bg-slate-200" />
                  <div className="h-10 w-full rounded-lg bg-slate-200" />
                </div>
                <div className="space-y-1.5">
                  <div className="h-4 w-20 rounded bg-slate-200" />
                  <div className="h-10 w-full rounded-lg bg-slate-200" />
                </div>
                <div className="space-y-1.5">
                  <div className="h-4 w-32 rounded bg-slate-200" />
                  <div className="h-10 w-full rounded-lg bg-slate-200" />
                </div>
                <div className="space-y-1.5">
                  <div className="h-4 w-40 rounded bg-slate-200" />
                  <div className="h-10 w-full rounded-lg bg-slate-200" />
                </div>
                <div className="h-10 w-32 rounded-full bg-slate-200" />
              </div>
            </div>
          </Skeleton>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-slate-50 pt-24 pb-10">
      <div className="mx-auto max-w-350 px-4 sm:px-5">
        <UploadAchievementForm user={user} />
      </div>
    </section>
  );
}
