'use client';

import { Suspense, useState } from 'react';
import toast from 'react-hot-toast';
import ModalChangePassword from '@/components/modals/ModalChangePassword';
import ModalConfirm from '@/components/modals/ModalConfirm';
import ModalEditAchievement from '@/components/modals/ModalEditAchievement';
import { useMySession } from '@/context/AuthContext';
import { useDeleteAchievement } from '@/hooks/mutations/useAchievementMutations';
import { apiErrorMessage } from '@/lib/apiError';
import type { StudentProfileProps } from '@/interfaces/ProfileInterfaces';
import type { Achievement } from '@/interfaces/AchievementInterfaces';
import ProfileHeaderCard from './ProfileHeaderCard';
import ScoreBreakdown from './ScoreBreakdown';
import SemesterHistoryTable from './SemesterHistoryTable';
import AchievementList from './AchievementList';
import ProfileSkeleton from './ProfileSkeleton';
import PageContainer from '@/components/layout/PageContainer';

/**
 * Профиль студента, собранный из подкомпонентов: шапка, диаграмма баллов,
 * история по семестрам и лента достижений. Здесь живут состояние модалок
 * и мутация удаления достижения.
 */
export default function StudentProfile({ profile, isOwner, loading = false }: StudentProfileProps) {
  const [editingDoc, setEditingDoc] = useState<Achievement | null>(null);
  const [deletingDoc, setDeletingDoc] = useState<Achievement | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);
  const deleteMutation = useDeleteAchievement();
  const { user } = useMySession();

  const handleDeleteConfirm = async () => {
    if (!deletingDoc) return;
    // Подтверждённое достижение удалять нельзя (дублирует запрет на сервере).
    if (deletingDoc.status_display === 'approved') {
      toast.error('Нельзя удалить подтверждённое достижение');
      setDeletingDoc(null);
      return;
    }
    try {
      // Профиль перезапросится сам: инвалидация кэша живёт в хуке мутации.
      await deleteMutation.mutateAsync(deletingDoc.id);
      toast.success('Достижение удалено');
      setDeletingDoc(null);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Не удалось удалить достижение'));
    }
  };

  // radar_stats может отсутствовать в ответе (рассинхрон версий бэка/сид-данных) —
  // не роняем весь профиль, а деградируем до пустой диаграммы.
  const radarLabels = profile?.radar_stats?.labels ?? [];
  const radarData = profile?.radar_stats?.data ?? [];

  const documents: Achievement[] = profile?.documents || [];
  const semesterHistory = profile?.semester_history ?? [];

  if (loading) return <ProfileSkeleton isOwner={isOwner} />;

  if (!profile) {
    return (
      <PageContainer>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5">
          <p className="text-center text-slate-500">Профиль не найден</p>
        </div>
      </PageContainer>
    );
  }

  return (
    <>
      <PageContainer className="animate-reveal">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_16px_50px_rgba(15,23,42,0.16)] sm:p-5">
          <ProfileHeaderCard
            profile={profile}
            onChangePassword={isOwner && !user?.is_employee ? () => setChangingPassword(true) : undefined}
          />
          <ScoreBreakdown radarLabels={radarLabels} radarData={radarData} isOwner={isOwner} />
        </div>

        <SemesterHistoryTable semesterHistory={semesterHistory} />

        <div className="mt-6">
          {/* useSearchParams в ленте требует Suspense; профиль и так рисуется только на клиенте. */}
          <Suspense fallback={null}>
            <AchievementList
              docs={documents}
              categoryLabels={radarLabels}
              isOwner={isOwner}
              onEdit={isOwner ? (d) => setEditingDoc(d) : undefined}
              onDelete={isOwner ? (d) => setDeletingDoc(d) : undefined}
            />
          </Suspense>
        </div>
      </PageContainer>

      <ModalEditAchievement
        isOpen={!!editingDoc}
        doc={editingDoc}
        onClose={() => setEditingDoc(null)}
      />

      <ModalConfirm
        isOpen={!!deletingDoc}
        title="Удалить достижение?"
        message="Достижение будет удалено безвозвратно."
        confirmLabel="Удалить"
        danger
        loading={deleteMutation.isPending}
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeletingDoc(null)}
      />

      <ModalChangePassword isOpen={changingPassword} onClose={() => setChangingPassword(false)} />
    </>
  );
}
