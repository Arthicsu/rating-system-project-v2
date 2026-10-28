'use client';
import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAchievement, useAchievementConfig } from '@/hooks/queries';
import { useUpdateAchievement } from '@/hooks/mutations/useAchievementMutations';
import { apiErrorMessage } from '@/lib/apiError';
import {
  MAX_FILES,
  MAX_TOTAL_SIZE,
  editAchievementSchema,
  type EditAchievementSubmit,
  type EditAchievementValues,
} from '@/lib/validation/achievement';
import type { PendingDocumentDto } from '@/lib/api';
import type { AchievementConfigResponse } from '@/interfaces/AchievementInterfaces';
import type { ModalEditAchievementProps } from '@/interfaces/ModalInterfaces';
import ModalShell from '@/components/modals/ModalShell';
import FileDropZone from '@/components/upload/FileDropZone';
import AchievementFields, { FieldError, getCurrentScore } from '@/components/achievement/AchievementFields';

const EMPTY: EditAchievementValues = {
  category: null, subType: null, level: null, result: null, docType: null,
  achievement: '', dateReceived: '', newFiles: [], removeFileIds: [], keptFileCount: 0,
};
const FILE_INPUT_ID = 'edit-achievement-files';

const formatMb = (bytes: number) => `${(Math.max(bytes, 0) / (1024 * 1024)).toFixed(1).replace('.', ',')} МБ`;

/** Значения формы из карточки заявки: селекты справочника ищутся по кодам. */
function initialValues(doc: PendingDocumentDto, config: AchievementConfigResponse): EditAchievementValues {
  return {
    category: doc.category_code,
    subType: config.structure[doc.category_code]?.sub_types.find((s) => s.code === doc.sub_type_code) ?? null,
    level: config.levels.find((l) => l.code === doc.level_code) ?? null,
    result: config.results.find((r) => r.code === doc.result_code) ?? null,
    docType: config.doc_types.find((d) => d.code === doc.doc_type_code) ?? null,
    achievement: doc.achievement ?? '',
    dateReceived: doc.date_received ? doc.date_received.slice(0, 10) : '',
    newFiles: [],
    removeFileIds: [],
    keptFileCount: doc.files?.length ?? 0,
  };
}

/**
 * Подробная правка заявки студентом: все поля, файлы по одному («Удалить», «Заменить»,
 * «Вернуть») и новые файлы в пределах 3 штук и 20 МБ вместе с оставленными.
 */
export default function ModalEditAchievement({ isOpen, doc, onClose }: ModalEditAchievementProps) {
  const updateMutation = useUpdateAchievement();
  // Инвалидация кэша после сохранения живёт в хуке мутации.
  const saving = updateMutation.isPending;
  const { data: config } = useAchievementConfig();
  // Карточка заявки: размеры файлов (их отдаёт только она) и коды для селектов.
  const { data: detail, isFetching, isError } = useAchievement(doc ? String(doc.id) : '', isOpen);
  const [seededDocId, setSeededDocId] = useState<string | null>(null);
  // Второй клик/Enter в том же кадре, до того как isPending успел стать true.
  const inFlightRef = useRef(false);

  const form = useForm<EditAchievementValues, unknown, EditAchievementSubmit>({
    resolver: zodResolver(editAchievementSchema),
    defaultValues: EMPTY,
  });
  const { handleSubmit, watch, setValue, getValues, reset, setError, trigger, formState: { errors } } = form;

  // Заполняем форму, когда пришли карточка и справочник (подстройка при рендере). Только по
  // свежим данным: после сохранения кэш карточки ещё перезапрашивается, а старые файлы в форме
  // дали бы remove_file_ids уже удалённых файлов.
  if (isOpen && detail && config && !isFetching && detail.id !== seededDocId) {
    setSeededDocId(detail.id);
    reset(initialValues(detail, config));
  }

  const removeIds = watch('removeFileIds');
  const newFiles = watch('newFiles');

  if (!doc) return null;

  const ready = seededDocId === doc.id && !!detail;
  const files = detail?.files ?? [];
  const kept = files.filter((f) => !removeIds.includes(f.id));
  const keptBytes = kept.reduce((sum, f) => sum + (f.size ?? 0), 0);
  const newBytes = newFiles.reduce((sum, f) => sum + f.size, 0);
  const isRejected = doc.status_display === 'rejected';
  const score = getCurrentScore(watch('subType'), watch('level'), watch('result'));

  // FileDropZone ждёт setState-совместимый сеттер (функциональный апдейт при удалении из списка).
  const setNewFiles: React.Dispatch<React.SetStateAction<File[]>> = (action) =>
    setValue('newFiles', typeof action === 'function' ? action(getValues('newFiles')) : action, {
      shouldValidate: true,
    });

  const toggleRemove = (id: string) => {
    const next = removeIds.includes(id) ? removeIds.filter((x) => x !== id) : [...removeIds, id];
    setValue('removeFileIds', next);
    setValue('keptFileCount', files.length - next.length);
    // Ошибка «от 1 до 3 файлов» висит на newFiles — обновляем её сразу, а не только при отправке.
    void trigger('newFiles');
  };

  // «Заменить» = отметить файл к удалению и сразу открыть выбор нового.
  const replace = (id: string) => {
    if (!removeIds.includes(id)) toggleRemove(id);
    document.getElementById(FILE_INPUT_ID)?.click();
  };

  const submitWith = (close: () => void) => async (values: EditAchievementSubmit) => {
    if (inFlightRef.current || !values.subType || !values.docType || !values.category) return;
    // «Вернуть» файл может перевалить за лимит — говорим здесь, а не тостом от сервера.
    if (keptBytes + newBytes > MAX_TOTAL_SIZE) {
      setError('newFiles', { message: 'Вместе файлы больше 20 МБ: удалите или замените что-нибудь' });
      return;
    }
    inFlightRef.current = true;

    const formData = new FormData();
    formData.append('category', values.category);
    formData.append('sub_type', values.subType.code);
    // Пустое значение сбрасывает уровень/результат, если новому виду деятельности они не нужны.
    formData.append('level', values.subType.needsLevel && values.level ? values.level.code : '');
    formData.append('result', values.subType.needsResult && values.result ? values.result.code : '');
    formData.append('doc_type', values.docType.code);
    formData.append('achievement', values.achievement);
    formData.append('date_received', values.dateReceived);
    values.removeFileIds.forEach((id) => formData.append('remove_file_ids', String(id)));
    values.newFiles.forEach((f) => formData.append('files', f));

    try {
      await updateMutation.mutateAsync({ id: doc.id, formData });
      toast.success(isRejected ? 'Сохранено и отправлено на повторное рассмотрение' : 'Изменения сохранены');
      close();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Не удалось сохранить изменения'));
    } finally {
      inFlightRef.current = false;
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      locked={saving}
      closeButton
      labelledBy="edit-achievement-title"
      // На телефоне — во весь экран, на десктопе — окно с прокруткой.
      overlayClassName="z-40 items-stretch justify-center sm:items-center sm:px-0 sm:py-6"
      panelClassName="relative h-full w-full overflow-y-auto bg-white p-4 shadow-[0_18px_60px_rgba(15,23,42,0.35)] sm:h-auto sm:max-h-full sm:max-w-xl sm:rounded-2xl sm:border sm:border-slate-100 sm:p-6"
      // Сброс позволяет переоткрыть ту же заявку с актуальными данными.
      onClosed={() => setSeededDocId(null)}
    >
      {(close) => (
        <>
          <h2 id="edit-achievement-title" className="mb-3 pr-8 text-base font-semibold text-slate-900">
            Редактирование заявки
          </h2>

          {isRejected && (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              После сохранения заявка будет повторно отправлена на рассмотрение.
            </p>
          )}

          {!ready ? (
            <p className="py-8 text-center text-sm text-slate-600">
              {isError ? 'Не удалось загрузить заявку. Закройте окно и попробуйте ещё раз.' : 'Загрузка заявки…'}
            </p>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit(submitWith(close))}>
              <AchievementFields form={form} config={config} idPrefix="edit" />

              <p className="text-sm text-slate-700">
                Баллы по правилам: <b className="font-semibold text-emerald-800">{score ?? 0}</b>
              </p>

              <fieldset className="space-y-2">
                <legend className="text-xs font-medium text-slate-600">
                  Файлы: {kept.length + newFiles.length} из {MAX_FILES}, свободно{' '}
                  {formatMb(MAX_TOTAL_SIZE - keptBytes - newBytes)}
                </legend>
                {files.map((file) => {
                  const removed = removeIds.includes(file.id);
                  const name = file.original_file_name || 'Файл';
                  return (
                    <div
                      key={file.id}
                      className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2 text-sm ${
                        removed ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <span className={`min-w-0 flex-1 truncate ${removed ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                        {name}
                        {file.size != null && <span className="ml-1 text-xs text-slate-600">({formatMb(file.size)})</span>}
                        {removed && <span className="sr-only"> — будет удалён</span>}
                      </span>
                      <span className="flex gap-1">
                        {!removed && (
                          <button
                            type="button"
                            onClick={() => replace(file.id)}
                            aria-label={`Заменить ${name}`}
                            className="cursor-pointer min-h-11 rounded-lg px-3 text-sm font-semibold text-sky-700 hover:bg-sky-50"
                          >
                            Заменить
                          </button>
                        )}
                        {/* Одна кнопка «Удалить / Вернуть»: фокус остаётся на ней после нажатия. */}
                        <button
                          type="button"
                          onClick={() => toggleRemove(file.id)}
                          aria-label={removed ? `Вернуть ${name}` : `Удалить ${name}`}
                          className={`cursor-pointer min-h-11 rounded-lg px-3 text-sm font-semibold ${
                            removed ? 'text-sky-700 hover:bg-sky-50' : 'text-rose-700 hover:bg-rose-50'
                          }`}
                        >
                          {removed ? 'Вернуть' : 'Удалить'}
                        </button>
                      </span>
                    </div>
                  );
                })}
                <FileDropZone
                  files={newFiles}
                  setFiles={setNewFiles}
                  maxFiles={MAX_FILES - kept.length}
                  reservedBytes={keptBytes}
                  inputId={FILE_INPUT_ID}
                />
                <FieldError message={errors.newFiles?.message} />
              </fieldset>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  aria-disabled={saving}
                  className="cursor-pointer inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:ring-offset-1 aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
                >
                  {saving ? 'Сохранение…' : 'Сохранить'}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={close}
                  className="cursor-pointer inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-slate-200 px-4 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Отмена
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </ModalShell>
  );
}
