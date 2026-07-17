'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import ModalConfirm from '@/components/modals/modalConfirm';
import ModalEditAchievement from '@/components/modals/modalEditAchievement';
import { useDeleteAchievement } from '@/hooks/mutations/useAchievementMutations';
import { apiErrorMessage } from '@/lib/apiError';
import type { StudentProfileProps } from '@/interfaces/ProfileInterfaces';
import type { Achievement } from '@/interfaces/AchievementInterfaces';
import { Skeleton } from 'boneyard-js/react';
import ProfileHeaderCard from './ProfileHeaderCard';
import ScoreBreakdown from './ScoreBreakdown';
import SemesterHistoryTable from './SemesterHistoryTable';
import AchievementSection from './AchievementSection';
import ProfileSkeleton from './ProfileSkeleton';

/**
 * Профиль студента, собранный из подкомпонентов: шапка, диаграмма баллов,
 * история по семестрам и секции достижений. Здесь живут состояние модалок
 * и мутация удаления достижения.
 */
export default function StudentProfile({ profile, isOwner, loading = false }: StudentProfileProps) {
  const [editingDoc, setEditingDoc] = useState<Achievement | null>(null);
  const [deletingDoc, setDeletingDoc] = useState<Achievement | null>(null);
  const deleteMutation = useDeleteAchievement();

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
  const approvedDocs = documents.filter((d) => d.status_display === 'approved');
  const pendingDocs = documents.filter((d) => d.status_display === 'pending');
  const rejectedDocs = documents.filter((d) => d.status_display === 'rejected');
  const semesterHistory = profile?.semester_history ?? [];

  if (loading) {
    // Кости student-profile рисуются поверх скрытого pulse-макета: он задаёт
    // высоту контейнера и остаётся запасным вариантом до гидрации бандла
    // (и на случай, если имя выпадет из bones/registry.js).
    return (
      <Skeleton name="student-profile" loading fallback={<ProfileSkeleton />}>
        <ProfileSkeleton />
      </Skeleton>
    );
  }

  if (!profile) {
    return (
      <section className="min-h-screen bg-slate-50 pt-24 pb-10">
        <div className="mx-auto max-w-350 px-4 sm:px-5">
          <div className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5">
            <p className="text-center text-slate-500">Профиль не найден</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      {/* Обёртка нужна сканеру boneyard: кости снимаются с настоящего DOM.
          Рантайм-скелетон живёт в ветке loading выше, здесь профиль уже загружен. */}
      <Skeleton name="student-profile" loading={false}>
      <section className="min-h-screen bg-slate-50 pt-24 pb-10">
        <div className="mx-auto max-w-350 px-4 sm:px-5">
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_16px_50px_rgba(15,23,42,0.16)] sm:p-5">
            <ProfileHeaderCard profile={profile} />
            <ScoreBreakdown radarLabels={radarLabels} radarData={radarData} isOwner={isOwner} />
          </div>

          <SemesterHistoryTable semesterHistory={semesterHistory} />

          <div className="mt-6 space-y-5">
            <AchievementSection variant="approved" docs={approvedDocs} />

            {/* {isOwner && pendingDocs.length > 0 && ( */}
            <AchievementSection
              variant="pending"
              docs={pendingDocs}
              onEdit={isOwner ? (d) => setEditingDoc(d) : undefined}
              onDelete={isOwner ? (d) => setDeletingDoc(d) : undefined}
            />

            {/* {isOwner && rejectedDocs.length > 0 && ( */}
            <AchievementSection
              variant="rejected"
              docs={rejectedDocs}
              onEdit={isOwner ? (d) => setEditingDoc(d) : undefined}
              onDelete={isOwner ? (d) => setDeletingDoc(d) : undefined}
            />
          </div>
        </div>
      </section>
      </Skeleton>

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
    </>
  );
}
