'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import type { AxiosError } from 'axios';

import { useMySession } from '@/context/AuthContext';
import { useAchievement } from '@/hooks/queries';
import { useDeleteAchievement } from '@/hooks/mutations/useAchievementMutations';
import { useRedirectIfLoggedOut } from '@/hooks/useRedirectIfLoggedOut';
import { useDownloadFile } from '@/hooks/useDownloadFile';
import { apiErrorMessage } from '@/lib/apiError';
import AchievementHeader from '@/components/achievement/AchievementHeader';
import AchievementDetails, { ReasonNote } from '@/components/achievement/AchievementDetails';
import AchievementFiles from '@/components/achievement/AchievementFiles';
import AchievementPreviewPane from '@/components/achievement/AchievementPreviewPane';
import ModalPreview from '@/components/modals/ModalPreview';
import ModalConfirm from '@/components/modals/ModalConfirm';
import ModalEditAchievement from '@/components/modals/ModalEditAchievement';

type LoadState = 'loading' | 'ready' | 'forbidden' | 'notfound' | 'error';

function PageSkeleton() {
  return (
    <main className="min-h-screen bg-slate-50 pt-24 pb-10">
      <div className="mx-auto max-w-350 px-4 sm:px-5">
        <div className="animate-pulse space-y-4">
          <div className="h-11 w-32 rounded-lg bg-slate-200" />
          <div className="h-28 rounded-2xl bg-slate-200" />
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="h-96 rounded-2xl bg-slate-200 lg:col-span-2" />
            <div className="h-96 rounded-2xl bg-slate-200 lg:col-span-3" />
          </div>
        </div>
      </div>
    </main>
  );
}

/** Страница заявки студента: сведения, файлы, предпросмотр; правка и удаление неподтверждённой. */
export default function AchievementDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { downloadFile } = useDownloadFile();
  const deleteMutation = useDeleteAchievement();

  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // После удаления до перехода в профиль не показываем «Заявка не найдена» от перезапроса.
  const [deleted, setDeleted] = useState(false);

  // Сброс UI-состояния при переходе между заявками без размонтирования (клиентская
  // навигация /achievement/1 → /achievement/2); данные перезагружает query по ключу id.
  const [loadedId, setLoadedId] = useState(id);
  if (id !== loadedId) {
    setLoadedId(id);
    setSelectedFileIndex(0);
    setPreviewOpen(false);
  }

  // Без сессии заявку не запрашиваем: после «Выйти» запрос получил бы 403, и интерсептор
  // принял бы выход за истёкшую сессию. Пока идёт редирект на вход - скелетон (isPending).
  const { user } = useMySession();
  useRedirectIfLoggedOut(`/achievement/${id}`);
  const { data: doc, isPending, error } = useAchievement(id, !!user);

  const errorStatus = (error as AxiosError | null)?.response?.status;
  const state: LoadState = isPending
    ? 'loading'
    : error
      ? errorStatus === 403
        ? 'forbidden'
        : errorStatus === 404
          ? 'notfound'
          : 'error'
      : 'ready';

  if (state === 'loading' || deleted) return <PageSkeleton />;

  if (state !== 'ready' || !doc) {
    const message =
      state === 'forbidden'
        ? 'У вас нет доступа к этой заявке.'
        : state === 'notfound'
          ? 'Заявка не найдена.'
          : 'Не удалось загрузить информацию о заявке.';
    return (
      <main className="min-h-screen bg-slate-50 pt-24 pb-10">
        <div className="mx-auto max-w-350 px-4 sm:px-5">
          <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center shadow-sm">
            <i className="fa-solid fa-circle-exclamation mb-3 text-3xl text-slate-300" aria-hidden="true" />
            <p className="text-sm text-slate-600">{message}</p>
            <button
              type="button"
              onClick={() => router.back()}
              className="mt-4 min-h-11 cursor-pointer rounded-lg bg-sky-700 px-4 text-sm font-medium text-white transition hover:bg-sky-800"
            >
              Назад
            </button>
          </div>
        </div>
      </main>
    );
  }

  const files = doc.files ?? [];
  const hasFiles = files.length > 0;
  // Студент видит только свои заявки (IsAchievementOwnerOrStaffInScope); подтверждённую
  // не правят и не удаляют - баллы уже начислены (сервер тоже запрещает).
  const canChange = !user?.is_employee && doc.status_display !== 'approved';

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(doc.id);
      setDeleted(true);
      toast.success('Заявка удалена');
      router.replace('/profile');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Не удалось удалить заявку'));
    }
  };

  return (
    <>
      <main className="min-h-screen bg-slate-50 pt-24 pb-10">
        <div className="mx-auto max-w-350 px-4 sm:px-5">
          <button
            type="button"
            onClick={() => router.back()}
            className="mb-1 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
          >
            <i className="fa-solid fa-arrow-left" aria-hidden="true" />
            Назад
          </button>

          <div className={`mt-5 grid gap-6 ${hasFiles ? 'lg:grid-cols-5' : 'mx-auto max-w-3xl grid-cols-1'}`}>
            <div className={`min-w-0 animate-fade-in space-y-5 ${hasFiles ? 'lg:col-span-2' : ''}`}>
              <AchievementHeader
                doc={doc}
                title={user?.is_employee ? doc.student_name : 'Заявка на достижение'}
                actions={
                  canChange && (
                    <>
                      <button
                        type="button"
                        onClick={() => setEditing(true)}
                        className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-sky-700 px-4 text-sm font-semibold text-white transition hover:bg-sky-800"
                      >
                        <i className="fa-solid fa-pen" aria-hidden="true" />
                        Редактировать
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                      >
                        <i className="fa-solid fa-trash" aria-hidden="true" />
                        Удалить
                      </button>
                    </>
                  )
                }
              />

              {doc.rejection_reason && (
                <ReasonNote
                  // Повторно поданная заявка хранит причину прошлого отклонения.
                  title={doc.status_display === 'pending' ? 'Причина прошлого отклонения' : 'Причина отклонения'}
                  text={doc.rejection_reason}
                />
              )}

              <AchievementDetails doc={doc} />
              <AchievementFiles files={files} onDownload={(fileId, name) => downloadFile(fileId, name)} />
            </div>

            {hasFiles && (
              <div className="min-w-0 animate-fade-in lg:col-span-3">
                <AchievementPreviewPane
                  files={files}
                  selectedIndex={selectedFileIndex}
                  onSelect={setSelectedFileIndex}
                  onFullscreen={() => setPreviewOpen(true)}
                  onDownload={(fileId, name) => downloadFile(fileId, name)}
                />
              </div>
            )}
          </div>
        </div>
      </main>

      <ModalPreview
        isOpen={previewOpen}
        doc={previewOpen ? doc : null}
        onClose={() => setPreviewOpen(false)}
        onDownload={(fileId, fileName) => downloadFile(fileId, fileName)}
      />

      <ModalEditAchievement isOpen={editing} doc={editing ? doc : null} onClose={() => setEditing(false)} />

      <ModalConfirm
        isOpen={confirmDelete}
        title="Удалить заявку?"
        message="Заявка и её файлы будут удалены безвозвратно."
        confirmLabel="Удалить"
        danger
        loading={deleteMutation.isPending}
        onConfirm={handleDelete}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  );
}
