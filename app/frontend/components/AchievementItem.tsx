import { useDownloadFile } from '@/hooks/useDownloadFile';
import type { AchievementItemProps } from '@/interfaces/AchievementInterfaces';
import { Skeleton } from 'boneyard-js/react';

export default function AchievementItem({ doc, loading = false }: AchievementItemProps) {
  const { downloadFile } = useDownloadFile();
  const statusIcon = doc?.status_display === 'rejected' ? 'fa-circle-xmark' : 'fa-file-lines';
  const receivedDateText = doc?.date_received ? new Date(doc.date_received).toLocaleDateString('ru-RU') : 'Не указана';
  const uploadedDateText = doc?.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString('ru-RU') : 'Не указана';
  
  if (loading) {
    return (
      <Skeleton name="achievement-item" loading={false}>
        <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.08)] sm:p-4.5 animate-pulse">
          <div className="flex flex-1 items-start gap-3">
            <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-slate-200" />
            <div className="min-w-0 space-y-2 flex-1">
              <div className="h-4 w-3/4 rounded bg-slate-200" />
              <div className="flex gap-2">
                <div className="h-5 w-16 rounded bg-slate-200" />
                <div className="h-5 w-20 rounded bg-slate-200" />
              </div>
              <div className="h-4 w-1/2 rounded bg-slate-200" />
            </div>
          </div>
          <div className="h-6 w-12 rounded-full bg-slate-200" />
        </div>
      </Skeleton>
    );
  }

  if (!doc) {
    return null;
  }

  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.08)] sm:p-4.5">
      <div className="flex flex-1 items-start gap-3">
        <div className="mt-1 flex px-1.5 sm:px-2 lg:px-2 py-1.5 sm:py-2 lg:py-2 items-center justify-center rounded-full bg-slate-900/90 text-white">
          <i className={`fa-regular ${statusIcon} text-sm`} />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-slate-900 wrap-break-word">
            {doc?.achievement}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600">
            <i className="fa-regular fa-bookmark mr-1" />
            <span className="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-800">
              {doc?.category_display}
            </span>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
              {doc?.sub_type_display}
            </span>
            {doc?.level_display && (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                {doc?.level_display}
              </span>
            )}
            {doc?.result_display && (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                {doc?.result_display}
              </span>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
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
                  onClick={() => downloadFile(file.id, file.original_file_name)}
                  className="cursor-pointer inline-flex cursor-pointer items-center gap-1 text-[11px] font-medium text-sky-700 hover:text-sky-900"
                >
                  <i className="fa-solid fa-file" />
                  {file.original_file_name || `Файл ${index + 1}`}
                </button>
              ))}
          </div>
        </div>
      </div>

      {doc?.status === 3 ? (
        <div className="max-w-xs rounded-xl bg-rose-50 px-3 py-2 md:text-xs lg:text-sm">
          <span className="font-medium text-rose-700">Причина:</span>{' '}
          <span className='text-black text-[14px] font-semibold'>{doc?.rejection_reason || 'Не указана'}</span>
        </div>
      ) : (
        <div className="ml-2 flex items-center whitespace-nowrap rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-600">
          +{doc?.score}
        </div>
      )}
    </div>
  );
}