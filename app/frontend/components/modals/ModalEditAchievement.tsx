'use client';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useUpdateAchievement } from '@/hooks/mutations/useAchievementMutations';
import { apiErrorMessage } from '@/lib/apiError';
import { editAchievementSchema, type EditAchievementValues } from '@/lib/validation/achievement';
import type { ModalEditAchievementProps } from '@/interfaces/ModalInterfaces';
import ModalShell from '@/components/modals/ModalShell';
import FileDropZone from '@/components/upload/FileDropZone';

export default function ModalEditAchievement({
  isOpen,
  doc,
  onClose,
}: ModalEditAchievementProps) {
  const updateMutation = useUpdateAchievement();
  // Инвалидация кэша после сохранения живёт в хуке мутации.
  const saving = updateMutation.isPending;
  const [seededDocId, setSeededDocId] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    reset,
    formState: { errors },
  } = useForm<EditAchievementValues>({
    resolver: zodResolver(editAchievementSchema),
    defaultValues: { achievement: '', dateReceived: '', files: [] },
  });

  const achievementName = watch('achievement');
  const files = watch('files');

  // FileDropZone ждёт setState-совместимый сеттер (использует в т.ч.
  // функциональный апдейт при удалении файла из списка).
  const setFiles: React.Dispatch<React.SetStateAction<File[]>> = (action) =>
    setValue('files', typeof action === 'function' ? action(getValues('files')) : action);

  // Заполняем форму при открытии модалки новой заявкой.
  if (doc && doc.id !== seededDocId) {
    setSeededDocId(doc.id);
    reset({
      achievement: doc.achievement ?? '',
      dateReceived: doc.date_received ? doc.date_received.slice(0, 10) : '',
      files: [],
    });
  }

  if (!doc) return null;

  const isRejected = doc.status_display === 'rejected';

  const submitWith = (close: () => void) => async (values: EditAchievementValues) => {
    if (saving) return;

    const formData = new FormData();
    formData.append('achievement', values.achievement);
    formData.append('date_received', values.dateReceived);
    values.files.forEach(f => formData.append('files', f));

    try {
      await updateMutation.mutateAsync({ id: doc.id, formData });
      toast.success(isRejected ? 'Сохранено и отправлено на повторное рассмотрение' : 'Изменения сохранены');
      close();
    } catch (error) {
      toast.error('Ошибка: ' + apiErrorMessage(error, 'не удалось сохранить'));
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      locked={saving}
      closeButton
      // Сброс позволяет переоткрыть ту же заявку с актуальными данными.
      onClosed={() => setSeededDocId(null)}
    >
      {(close) => (
        <>
          <h2 className="mb-3 text-base font-semibold text-slate-900">
            Редактирование достижения
          </h2>

          {isRejected && (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              После сохранения заявка будет повторно отправлена на рассмотрение.
            </p>
          )}

          <form className="space-y-4" onSubmit={handleSubmit(submitWith(close))}>
            <div className="space-y-1.5">
              <label htmlFor="edit-achievement-name" className="text-[11px] font-medium text-slate-500">
                Название достижения
              </label>
              <div className="relative">
                <textarea
                  id="edit-achievement-name"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-600 focus:bg-white focus:ring-2 focus:ring-sky-600 resize-none"
                  rows={2}
                  maxLength={1000}
                  placeholder="Название как в документе"
                  {...register('achievement')}
                />
                <span className="absolute bottom-1.5 right-2 text-[10px] text-slate-400">
                  {achievementName.length}/1000
                </span>
              </div>
              {errors.achievement?.message && (
                <p className="text-xs text-rose-600">{errors.achievement.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="edit-date-received" className="text-[11px] font-medium text-slate-500">
                Дата получения достижения
              </label>
              <input
                id="edit-date-received"
                type="date"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-600 focus:bg-white focus:ring-2 focus:ring-sky-600"
                {...register('dateReceived')}
              />
              {errors.dateReceived?.message && (
                <p className="text-xs text-rose-600">{errors.dateReceived.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-slate-500">
                Заменить файлы (необязательно)
              </label>
              <p className="text-[11px] text-slate-400">
                Если выбрать новые файлы — старые будут заменены. Перетащите или выберите до 3 файлов, общий размер до 20 МБ.
              </p>
              <FileDropZone files={files} setFiles={setFiles} />
            </div>

            <div className="mt-2 flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="cursor-pointer inline-flex flex-1 items-center justify-center rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Сохранение…' : 'Сохранить'}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={close}
                className="cursor-pointer inline-flex flex-1 items-center justify-center rounded-full bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Отмена
              </button>
            </div>
          </form>
        </>
      )}
    </ModalShell>
  );
}
