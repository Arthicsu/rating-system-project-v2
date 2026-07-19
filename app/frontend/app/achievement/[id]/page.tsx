'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { AxiosError } from 'axios';

import { useAchievement } from '@/hooks/queries';
import { useDownloadFile } from '@/hooks/useDownloadFile';
import FilePreviewPanel from '@/components/preview/FilePreviewPanel';
import ModalPreview from '@/components/modals/ModalPreview';

type LoadState = 'loading' | 'ready' | 'forbidden' | 'notfound' | 'error';

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  approved: { label: 'Подтверждено', className: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Отклонено', className: 'bg-rose-100 text-rose-700' },
  pending: { label: 'На рассмотрении', className: 'bg-amber-100 text-amber-700' },
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString('ru-RU');
}

export default function AchievementDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { downloadFile } = useDownloadFile();

  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Сброс UI-состояния при переходе между заявками без размонтирования (клиентская
  // навигация /achievement/1 → /achievement/2); данные перезагружает query по ключу id.
  const [loadedId, setLoadedId] = useState(id);
  if (id !== loadedId) {
    setLoadedId(id);
    setSelectedFileIndex(0);
    setPreviewOpen(false);
  }

  const { data: doc, isPending, error } = useAchievement(id);

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

  if (state === 'loading') {
    return (
      <main className="min-h-screen bg-slate-50 pt-24 pb-10">
        <div className="mx-auto max-w-350 px-4 sm:px-5">
          <div className="animate-pulse space-y-4">
            <div className="h-9 w-32 rounded-lg bg-slate-200" />
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
            <i className="fa-solid fa-circle-exclamation mb-3 text-3xl text-slate-300" />
            <p className="text-sm text-slate-600">{message}</p>
            <button
              type="button"
              onClick={() => router.back()}
              className="mt-4 cursor-pointer rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-800"
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
  const selectedFile = files[selectedFileIndex] ?? files[0] ?? null;
  const status = STATUS_BADGE[doc.status_display ?? ''] ?? null;

  return (
    <>
      <main className="min-h-screen bg-slate-50 pt-24 pb-10">
        <div className="mx-auto max-w-350 px-4 sm:px-5">
          <button
            type="button"
            onClick={() => router.back()}
            className="mb-1 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
          >
            <i className="fa-solid fa-arrow-left" />
            Назад
          </button>

          {/* Контент: детали + предпросмотр */}
          <div
            className={`mt-5 grid gap-6 ${
              hasFiles ? 'lg:grid-cols-5' : 'mx-auto max-w-3xl grid-cols-1'
            }`}
          >
            {/* Детали заявки */}
            <div className={`animate-fade-in space-y-5 ${hasFiles ? 'lg:col-span-2' : ''}`}>
              <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h1 className="text-lg font-semibold text-slate-900 sm:text-xl md:text-2xl">
                      {doc.student_name}
                    </h1>
                    <p className="text-sm text-slate-500">Зачетная книжка: {doc.record_book || '—'}</p>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                      <span>Курс: {doc.course}</span>
                      <span>Факультет: {doc.faculty}</span>
                      <span>Группа: {doc.group}</span>
                    </div>
                  </div>
                  <div className="flex justify-end flex-wrap items-center gap-2">
                    {status && (
                      <span className={`rounded-full px-3 py-1 text-center text-sm font-semibold ${status.className}`}>
                        {status.label}
                      </span>
                    )}
                    <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
                      +{doc.score}
                    </span>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="mb-2 text-base font-medium text-slate-800">
                  Дополнительная информация
                </h2>
                <textarea 
                  readOnly
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-1.5 text-sm text-slate-900 shadow-sm outline-none ring-sky-600/0 transition placeholder:text-slate-400 focus:border-sky-600 focus:bg-white focus:ring-2 focus:ring-sky-600"
                  rows={2}
                  maxLength={1000}
                  value={doc.achievement || '—'}
                />
              </section>

              <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  О достижении
                </h3>
                <div className="flex flex-col gap-2.5 text-sm text-slate-800">
                  <p>
                    Категория:{' '}
                    <span className="inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-medium text-amber-700">
                      {doc.category_display || '—'}
                    </span>
                  </p>
                  <p>
                    Подкатегория:{' '}
                    <span className="inline-block rounded bg-slate-100 px-2.5 py-0.5 text-sm text-slate-600">
                      {doc.sub_type_display || '—'}
                    </span>
                  </p>
                  {doc.level_display && (
                    <p>
                      Уровень:{' '}
                      <span className="inline-flex rounded bg-sky-50 px-2.5 py-0.5 text-sm text-sky-700">
                        {doc.level_display}
                      </span>
                    </p>
                  )}
                  {doc.result_display && (
                    <p>
                      Результат:{' '}
                      <span className="inline-flex rounded bg-purple-50 px-2.5 py-0.5 text-sm text-purple-700">
                        {doc.result_display}
                      </span>
                    </p>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Даты</h3>
                <div className="flex flex-col gap-1.5 text-sm text-slate-600">
                  <span>
                    <i className="fa-regular fa-calendar-check mr-1.5" />
                    Дата получения: {formatDate(doc.date_received)}
                  </span>
                  <span>
                    <i className="fa-regular fa-calendar mr-1.5" />
                    Дата загрузки: {formatDate(doc.uploaded_at)}
                  </span>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Документы
                </h3>
                {hasFiles ? (
                  <>
                    <p className="mb-2 text-sm text-slate-800">
                      Тип документа(-ов):{' '}
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-sm text-indigo-700">
                        {doc.doc_type_display || '—'}
                      </span>
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {files.map((file, index) => (
                        <button
                          key={file.id}
                          type="button"
                          onClick={() => downloadFile(file.id, file.original_file_name ?? `Файл ${index + 1}`)}
                          className="flex cursor-pointer items-center gap-2 text-left text-sm text-sky-700 transition hover:text-sky-800"
                        >
                          <i className="fa-solid fa-download" />
                          <span className="truncate">{file.original_file_name || `Файл ${index + 1}`}</span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">К заявке не прикреплены документы.</p>
                )}
              </section>

              {doc.rejection_reason && (
                <section className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 shadow-sm sm:p-5">
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-rose-700">
                    Причина отклонения
                  </h3>
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">
                    {doc.rejection_reason}
                  </p>
                </section>
              )}
            </div>

            {/* Предпросмотр документов */}
            {hasFiles && (
              <div className="animate-fade-in lg:col-span-3">
                <div className="flex h-[80vh] min-h-[500px] flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm lg:h-[calc(120vh-10rem)]">
                  <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <i className="fa-solid fa-file-magnifying-glass text-sky-700" />
                      <span className="truncate text-sm font-semibold text-slate-800">
                        {selectedFile?.original_file_name || 'Предпросмотр документа'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPreviewOpen(true)}
                      className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                      title="Открыть на весь экран"
                    >
                      <i className="fa-solid fa-expand" />
                      <span className="hidden sm:inline">На весь экран</span>
                    </button>
                  </div>

                  {files.length > 1 && (
                    <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-200 bg-white px-2 py-2 sm:px-3">
                      {files.map((file, index) => (
                        <button
                          key={file.id}
                          type="button"
                          onClick={() => setSelectedFileIndex(index)}
                          title={file.original_file_name || `Файл ${index + 1}`}
                          className={`max-w-40 min-w-0 shrink-0 cursor-pointer overflow-hidden rounded-lg px-3 py-1.5 text-xs font-medium transition sm:max-w-60 ${
                            index === selectedFileIndex
                              ? 'bg-sky-700 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          <span className="block truncate">{file.original_file_name || `Файл ${index + 1}`}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    {selectedFile ? (
                      <FilePreviewPanel
                        key={selectedFile.id}
                        fileId={selectedFile.id}
                        fileName={selectedFile.original_file_name ?? ''}
                        isOpen
                        onDownload={() =>
                          downloadFile(selectedFile.id, selectedFile.original_file_name ?? '')
                        }
                      />
                    ) : (
                      <div className="flex flex-1 items-center justify-center p-6 text-sm text-slate-500">
                        Нет прикреплённых файлов
                      </div>
                    )}
                  </div>
                </div>
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
    </>
  );
}
