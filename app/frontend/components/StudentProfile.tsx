import {Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend, } from 'chart.js';
import { Radar } from 'react-chartjs-2';
import api from '@/lib/axios';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

function AchievementItem({ doc } : {doc: any}) {
  const statusIcon = doc.status_display == 'rejected' ? 'fa-circle-xmark' : 'fa-file-lines';
  const receivedDateText = doc.date_received
    ? new Date(doc.date_received).toLocaleDateString('ru-RU')
    : 'Не указана';
  const uploadedDateText = doc.uploaded_at
    ? new Date(doc.uploaded_at).toLocaleDateString('ru-RU')
    : '—';
  const downloadFile = async (fileId: number, fileName: string) => {
    try {
      const response = await api.get(`/student/api/v1/document/download/${fileId}/`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Ошибка:', error);
    }
  };
  
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.08)] sm:p-4.5">
      <div className="flex flex-1 items-start gap-3">
        <div className="mt-1 flex px-1.5 sm:px-2 lg:px-2 py-1.5 sm:py-2 lg:py-2 items-center justify-center rounded-full bg-slate-900/90 text-white">
          <i className={`fa-regular ${statusIcon} text-sm`} />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-slate-900 wrap-break-word">
            {doc.achievement}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600">
            <i className="fa-regular fa-bookmark mr-1" />
            <span className="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-800">
              {doc.category_display}
            </span>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
              {doc.sub_type_display}
            </span>
            {doc.level && (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                {doc.level_display}
              </span>
            )}
            {doc.result && (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                {doc.result_display}
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
            {doc.files && doc.files.length > 0 &&
              doc.files.map((file: any, index: number) => (
                <button
                  key={file.id}
                  onClick={() => downloadFile(file.id, file.original_file_name)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-700 hover:text-sky-900"
                >
                  <i className="fa-solid fa-file" />
                  {file.original_file_name || `Файл ${index + 1}`}
                </button>
              ))}
          </div>
        </div>
      </div>

      {doc.status == 3 ? (
        <div className="max-w-xs rounded-xl bg-rose-50 px-3 py-2 md:text-xs lg:text-sm">
          <span className="font-medium text-rose-700">Причина:</span>{' '}
          <span className='text-black text-[14px] font-semibold'>{doc.rejection_reason || 'Не указана'}</span>
        </div>
      ) : (
        <div className="ml-2 flex items-center whitespace-nowrap rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-600">
          +{doc.score}
        </div>
      )}
    </div>
  );
}

export default function StudentProfile({ profile, isOwner }: { profile: any, isOwner: any }) {
  const data = {
    labels: profile.radar_stats.labels,
    datasets: [
      {
        label: 'Баллы',
        data: profile.radar_stats.data,
        backgroundColor: 'rgba(0, 80, 207, 0.2)',
        borderColor: '#0050CF',
        borderWidth: 2,
        pointBackgroundColor: '#0050CF',
      },
    ],
  };

  const options = {
    scales: {
      r: {
        angleLines: { display: true },
        suggestedMin: 0,
        suggestedMax: 15,
      },
    },
    plugins: {
      legend: { display: false },
    },
  };

  const documents = profile.documents || [];
  const approvedDocs = documents.filter((d: any) => d.status_display == 'approved');
  const pendingDocs = documents.filter((d: any) => d.status_display == 'pending');
  const rejectedDocs = documents.filter((d: any) => d.status_display == 'rejected');

  return (
    <>
      <section className="min-h-screen bg-slate-50 pt-24 pb-10">
        <div className="mx-auto max-w-350 px-4 sm:px-5">
          {/* Основная карточка профиля */}
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_16px_50px_rgba(15,23,42,0.16)] sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1.5">
                <h1 className="text-lg font-semibold text-slate-900 sm:text-xl md:text-2xl">
                  {profile.full_name}
                </h1>
                <p className="text-xs text-slate-500 sm:text-sm">
                  Зачетная книжка:{' '}
                  <span className="font-medium text-slate-800">
                    {profile.record_book}
                  </span>
                </p>
                <p className="text-xs text-slate-500 sm:text-sm">
                  {profile.faculty}{' '}
                  <span className="mx-1 text-slate-300">•</span>
                  {profile.course} курс
                  <span className="mx-1 text-slate-300">•</span>
                  группа {profile.group}
                </p>
              </div>
              <div className="mt-2 flex items-center justify-start sm:mt-0 sm:justify-end">
                <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-right shadow-sm">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    Общий балл
                  </div>
                  <div className="text-2xl font-bold text-sky-700 sm:text-3xl">
                    {profile.total_score}
                  </div>
                </div>
              </div>
            </div>

            {/* Сетка статистики */}
            <div className="mt-6 flex flex-col gap-5 lg:grid lg:grid-cols-3">
              <div className="space-y-3 col-span-2 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:p-5">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Распределение баллов по видам деятельности
                </p>
                <div className="space-y-2.5">
                  {profile.radar_stats.labels.map(
                    (label: string, index: number) => (
                      <div
                        key={label}
                        className="flex items-center justify-between rounded-xl bg-sky-50 px-3 py-2 text-xs text-slate-800 sm:text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-sky-600" />
                          <span>{label}</span>
                        </div>
                        <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-sky-700 shadow-sm">
                          {profile.radar_stats.data[index]}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:p-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Диаграмма распределения баллов
                </p>
                <div className="relative h-72">
                  <Radar data={data} options={options as any} />
                </div>
              </div>
            </div>
          </div>

          {/* Достижения */}
          <div className="mt-6 space-y-5">
            {/* Подтвержденные */}
            {approvedDocs.length > 0 && (
              <div className="rounded-2xl border border-emerald-100 bg-slate-500/80 p-4 shadow-sm sm:p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <i className="fa-solid fa-check" />
                  </span>
                  <h2 className="text-sm font-semibold text-white sm:text-base">
                    Подтвержденные достижения
                  </h2>
                </div>
                <div className="space-y-3">
                  {approvedDocs.map((doc: any) => (
                    <AchievementItem key={doc.id} doc={doc} />
                  ))}
                </div>
              </div>
            )}

            {/* В ожидании */}
            {isOwner && pendingDocs.length > 0 && (
              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 shadow-sm sm:p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-white">
                    <i className="fa-regular fa-clock" />
                  </span>
                  <h2 className="text-sm font-semibold text-amber-900 sm:text-base">
                    Ожидающие подтверждения
                  </h2>
                </div>
                <div className="space-y-3">
                  {pendingDocs.map((doc: any) => (
                    <AchievementItem key={doc.id} doc={doc} />
                  ))}
                </div>
              </div>
            )}

            {/* Отклоненные */}
            {isOwner && rejectedDocs.length > 0 && (
              <div className="rounded-2xl border border-rose-100 bg-rose-200 p-4 shadow-sm sm:p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-500 text-white">
                    <i className="fa-regular fa-circle-xmark" />
                  </span>
                  <h2 className="text-sm font-semibold text-rose-900 sm:text-base">
                    Отклоненные
                  </h2>
                </div>
                <div className="space-y-3">
                  {rejectedDocs.map((doc: any) => (
                    <AchievementItem key={doc.id} doc={doc} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {isOwner && (
            <div className="mt-6 flex justify-center ">
              <button className='bg-emerald-600 rounded-full hover:bg-emerald-700 transition shadow-emerald-300 shadow-lg'>
                <a
                href="/upload_achievement"
                className="inline-flex items-center rounded-full justify-center px-5 py-2.5 text-sm font-semibold text-white "
              >
                Загрузить новое достижение
              </a>
              </button>
            </div>
          )}
        </div>
      </section>
    </>
  );
 }