'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

import { useMySession } from '@/context/AuthContext';
import { useAchievement } from '@/hooks/queries';
import { useRedirectIfLoggedOut } from '@/hooks/useRedirectIfLoggedOut';
import { useDownloadFile } from '@/hooks/useDownloadFile';
import { useReviewActions } from '@/hooks/useReviewActions';
import AchievementHeader from '@/components/achievement/AchievementHeader';
import AchievementDetails, { ReasonNote } from '@/components/achievement/AchievementDetails';
import AchievementFiles from '@/components/achievement/AchievementFiles';
import AchievementPreviewPane from '@/components/achievement/AchievementPreviewPane';
import { BackButton, DetailError, DetailSkeleton, detailLoadState } from '@/components/achievement/DetailStates';
import ModalPreview from '@/components/modals/ModalPreview';
import ModalApprove from '../../_components/ModalApprove';
import ModalReject from '../../_components/ModalReject';
import ModerationPanel from '../../_components/ModerationPanel';

/**
 * Guard страницы заявки сотрудника, как у кабинета: пока роль не подтверждена — ничего не
 * рендерим и не запрашиваем; студента уводим в профиль, анонима — на вход. Защита данных —
 * на бэкенде (IsAchievementOwnerOrStaffInScope, CanReviewDocument).
 */
export default function StaffRequestPage() {
  const { user, loading } = useMySession();
  const router = useRouter();
  const id = useParams().id as string;
  useRedirectIfLoggedOut(`/staff-profile/requests/${id}`);

  useEffect(() => {
    if (user && !user.is_employee) router.replace('/profile');
  }, [user, router]);

  if (loading || !user?.is_employee) return null;
  return <StaffRequest key={id} id={id} />;
}

/** Заявка для сотрудника: студент, сведения, файлы и панель решения по правилам варианта А. */
function StaffRequest({ id }: { id: string }) {
  const router = useRouter();
  const { downloadFile } = useDownloadFile();
  const { openModal, actionsFor, modalApproveProps, modalRejectProps } = useReviewActions();
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);

  // После решения useReviewDocument инвалидирует карточку - статус обновится на месте.
  const { data: doc, isPending, error } = useAchievement(id, true);
  const state = detailLoadState(isPending, error);

  if (state === 'loading') return <DetailSkeleton />;
  if (state !== 'ready' || !doc) return <DetailError state={state} onBack={() => router.back()} />;

  const files = doc.files ?? [];
  const hasFiles = files.length > 0;
  const meta = [doc.record_book, doc.group, doc.course ? `${doc.course} курс` : null, doc.faculty]
    .filter(Boolean)
    .join(' · ');

  let reasonTitle: string | null = null;
  if (doc.rejection_reason) {
    if (doc.status_display === 'rejected') reasonTitle = 'Причина отклонения';
    else if (doc.status_display === 'pending') {
      reasonTitle = doc.returned_by
        ? `Возвращена ${doc.returned_by === 'Dean' ? 'деканатом' : 'ректоратом'}`
        : 'Ранее отклонялась';
    }
  }

  const download = (fileId: number, name: string) => downloadFile(fileId, name);

  return (
    <>
      <main className="min-h-screen bg-slate-50 pt-24 pb-10">
        <div className="mx-auto max-w-350 px-4 sm:px-5">
          <BackButton onClick={() => router.back()} />

          <div className={`mt-5 grid gap-6 ${hasFiles ? 'lg:grid-cols-5' : 'mx-auto max-w-3xl grid-cols-1'}`}>
            <div className={`min-w-0 animate-fade-in space-y-5 ${hasFiles ? 'lg:col-span-2' : ''}`}>
              <AchievementHeader
                doc={doc}
                approvedLabel="Одобрено"
                title={
                  <Link href={`/profile/${doc.student_id}`} className="text-sky-700 hover:text-sky-900 hover:underline">
                    {doc.student_name}
                  </Link>
                }
              >
                <p className="mt-1 break-words text-sm text-slate-600">{meta}</p>
              </AchievementHeader>

              <ModerationPanel doc={doc} actions={actionsFor(doc)} onAction={openModal} />

              {reasonTitle && doc.rejection_reason && <ReasonNote title={reasonTitle} text={doc.rejection_reason} />}

              <AchievementDetails doc={doc} />
              <AchievementFiles files={files} onDownload={download} />
            </div>

            {hasFiles && (
              <div className="min-w-0 animate-fade-in lg:col-span-3">
                <AchievementPreviewPane
                  files={files}
                  selectedIndex={selectedFileIndex}
                  onSelect={setSelectedFileIndex}
                  onFullscreen={() => setPreviewOpen(true)}
                  onDownload={download}
                />
              </div>
            )}
          </div>
        </div>
      </main>

      <ModalPreview isOpen={previewOpen} doc={previewOpen ? doc : null} onClose={() => setPreviewOpen(false)} onDownload={download} />
      <ModalApprove {...modalApproveProps} />
      <ModalReject {...modalRejectProps} />
    </>
  );
}
