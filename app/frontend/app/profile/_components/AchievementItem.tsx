import Link from 'next/link';
import Button from '@/components/Button';
import Card from '@/components/Card';
import { useMySession } from '@/context/AuthContext';
import { useDownloadFile } from '@/hooks/useDownloadFile';
import type { AchievementItemProps } from '@/interfaces/AchievementInterfaces';
import { STATUS_BADGE } from '@/components/achievement/AchievementHeader';

/**
 * Раскладка карточки заявки; её же повторяет скелетон ленты. Крупный текст - раскладка телефона на любой ширине:
 * справа одной строкой метки и кнопки сжали бы текст заявки в узкий столбик.
 */
export const ITEM_LAYOUT =
  'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 low-vision:flex-col low-vision:items-stretch';

/** Статус и балл: на телефоне и крупным текстом - нижней строкой, на ПК - справа одной строкой. */
export const ITEM_SIDE =
  'flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 sm:ml-2 sm:flex-nowrap sm:border-0 sm:pt-0 ' +
  'low-vision:ml-0 low-vision:flex-wrap low-vision:border-t low-vision:pt-3';

export default function AchievementItem({ doc, onEdit, onDelete }: AchievementItemProps) {
  const { downloadFile } = useDownloadFile();
  // Сотрудник (профиль студента из кабинета) открывает заявку на своей странице, с модерацией.
  const { user } = useMySession();
  const statusIcon = doc?.status_display === 'rejected' ? 'fa-circle-xmark' : 'fa-file-lines';
  const status = doc ? STATUS_BADGE[doc.status_display] : undefined;
  const receivedDateText = doc?.date_received ? new Date(doc.date_received).toLocaleDateString('ru-RU') : 'Не указана';
  const uploadedDateText = doc?.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString('ru-RU') : 'Не указана';

  if (!doc) {
    return null;
  }

  return (
    <>
    <Card padding="sm" className={ITEM_LAYOUT}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className="mt-1 flex px-1.5 sm:px-2 lg:px-2 py-1.5 sm:py-2 lg:py-2 items-center justify-center rounded-full bg-sky-700 text-white">
          <i className={`fa-regular ${statusIcon} text-sm`} />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-slate-900 wrap-break-word">
            {doc?.achievement}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 text-2xs text-slate-600">
            <i className="fa-regular fa-bookmark mr-1" />
            <span className="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-2xs font-medium text-sky-700">
              {doc?.category_display}
            </span>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-2xs text-slate-700">
              {doc?.sub_type_display}
            </span>
            {doc?.level_display && (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-2xs text-slate-700">
                {doc?.level_display}
              </span>
            )}
            {doc?.result_display && (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-2xs text-slate-700">
                {doc?.result_display}
              </span>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-2xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <i className="fa-regular fa-calendar-check" />
              Дата получения: {receivedDateText}
            </span>
            <span className="inline-flex items-center gap-1">
              <i className="fa-regular fa-calendar" />
              Дата загрузки: {uploadedDateText}
            </span>
            {doc?.files && doc.files.length > 0 &&
              doc.files.map((file, index) => (
                <button
                  key={file.id}
                  onClick={() => downloadFile(file.id, file.original_file_name ?? `Файл ${index + 1}`)}
                  className="cursor-pointer inline-flex items-baseline gap-1 text-left text-2xs font-medium text-sky-700 wrap-anywhere hover:text-sky-900"
                >
                  <i className="fa-solid fa-file" />
                  {file.original_file_name || `Файл ${index + 1}`}
                </button>
              ))}
            <span className="flex items-center gap-1.5">
              <Link
                href={user?.is_employee ? `/staff-profile/requests/${doc.id}` : `/achievement/${doc.id}`}
                className="mr-1 inline-flex min-h-11 items-center text-2xs font-semibold text-sky-700 underline-offset-2 hover:text-sky-900 sm:min-h-6 [[data-lv-scheme]_&]:underline"
              >
                Подробнее
              </Link>
              {onEdit && (
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={() => onEdit(doc)}
                  aria-label="Редактировать достижение"
                  title="Редактировать"
                >
                  <i className="fa-solid fa-pen text-sm" aria-hidden="true" />
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="danger-outline"
                  size="icon"
                  onClick={() => onDelete(doc)}
                  aria-label="Удалить достижение"
                  title="Удалить"
                >
                  <i className="fa-solid fa-trash text-sm" aria-hidden="true" />
                </Button>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* На телефоне статус и балл - нижней строкой, чтобы текст занимал всю ширину карточки. */}
      <div className={ITEM_SIDE}>
        <div className="flex flex-wrap items-center gap-1.5">
          {status && (
            <span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}>
              {status.label}
            </span>
          )}
          <div className="flex items-center whitespace-nowrap rounded-full border tracking-wide border-emerald-100 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
            +{doc?.score}
          </div>
        </div>
      </div>
    </Card>
    {doc?.status_display == 'rejected' && doc?.rejection_reason && (
      <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50/70 p-4">
        <p className="mb-1 text-sm font-semibold text-rose-700">
          Причина отклонения
        </p>
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">
          {doc.rejection_reason}
        </p>
      </div>
    )}
  </>
  );
}
