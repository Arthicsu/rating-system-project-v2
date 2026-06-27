'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { ModalPreviewProps } from '@/interfaces/ModalInterfaces';
import { useFilePreview, getFilePreviewKind } from '@/hooks/useFilePreview';

function FilePreviewPanel({
  fileId,
  fileName,
  isOpen,
  onDownload,
}: {
  fileId: number;
  fileName: string;
  isOpen: boolean;
  onDownload: () => void;
}) {
  const { previewUrl, loading, error } = useFilePreview(fileId, isOpen);
  const previewKind = getFilePreviewKind(fileName);

  if (loading) {
    return (
      <div className="flex h-full min-h-[inherit] flex-1 items-center justify-center p-4 text-sm text-slate-500 sm:p-6">
        <i className="fa-solid fa-spinner fa-spin mr-2" />
        Загрузка предпросмотра...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full min-h-[inherit] flex-1 flex-col items-center justify-center gap-3 p-4 text-center sm:p-6">
        <p className="text-sm text-rose-600">{error}</p>
        <button
          type="button"
          onClick={onDownload}
          className="cursor-pointer rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700"
        >
          Скачать файл
        </button>
      </div>
    );
  }

  if (!previewUrl) return null;

  if (previewKind === 'pdf') {
    return (
      <iframe
        src={previewUrl}
        title={fileName}
        className="h-full min-h-[inherit] w-full flex-1 border-0 bg-white"
      />
    );
  }

  if (previewKind === 'image') {
    return (
      <div className="flex h-full min-h-[inherit] flex-1 items-center justify-center overflow-auto p-3 sm:p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt={fileName}
          className="max-h-full max-w-full object-contain"
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[inherit] flex-1 flex-col items-center justify-center gap-3 p-4 text-center sm:p-6">
      <i className="fa-solid fa-file text-3xl text-slate-400 sm:text-4xl" />
      <p className="max-w-xs text-sm text-slate-600">
        Предпросмотр недоступен для этого типа файла
      </p>
      <button
        type="button"
        onClick={onDownload}
        className="cursor-pointer rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700"
      >
        Скачать файл
      </button>
    </div>
  );
}

export default function ModalPreview({ isOpen, doc, onClose, onDownload }: ModalPreviewProps) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewSectionRef = useRef<HTMLDivElement | null>(null);

  const handleSelectFile = useCallback((index: number) => {
    setSelectedFileIndex(index);
    previewSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  useEffect(() => {
    if (isOpen && doc) {
      setSelectedFileIndex(0);
    }
  }, [isOpen, doc?.id]);

  useEffect(() => {
    if (isOpen && !closing) {
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
  }, [isOpen, closing]);

  useEffect(() => {
    if (!isOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleClose = useCallback(() => {
    setVisible(false);
    setClosing(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onClose();
      setClosing(false);
    }, 200);
  }, [onClose]);

  if (!isOpen && !closing) return null;

  const files = doc?.files ?? [];
  const selectedFile = files[selectedFileIndex] ?? null;

  return (
    <div
      className={`fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:p-4 md:p-6 transition-all duration-200 ${
        visible ? 'bg-slate-900/60' : 'bg-slate-900/0 pointer-events-none'
      }`}

      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className={`relative flex w-full flex-col overflow-hidden bg-white shadow-[0_18px_60px_rgba(15,23,42,0.35)] transform transition-all duration-200
          h-[100dvh] max-h-[100dvh] rounded-none
          sm:h-auto sm:max-h-[96vh] sm:min-h-[580px] sm:max-w-[min(98vw,96rem)] sm:rounded-2xl sm:border sm:border-slate-100
          md:min-h-[660px]
          xl:max-h-[94vh] xl:min-h-[720px] xl:flex-row
          ${visible ? 'opacity-100 scale-100 sm:translate-y-0' : 'opacity-0 scale-95 sm:translate-y-2'}
        `}
      >
        <button
          type="button"
          aria-label="Закрыть"
          className="cursor-pointer absolute right-2 top-2 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-xl text-slate-500 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-100 hover:text-slate-800 sm:right-3 sm:top-3"
          onClick={handleClose}
        >
          &times;
        </button>

        {/* Левая колонка — предпросмотр файла */}
        <div
          ref={previewSectionRef}
          className="flex w-full shrink-0 flex-col border-b border-slate-200 bg-slate-100
            h-[45vh] min-h-[260px] max-h-[52vh]
            sm:h-[50vh] sm:min-h-[320px] sm:max-h-[58vh]
            md:h-[54vh] md:min-h-[360px]
            xl:h-auto xl:min-h-0 xl:max-h-none xl:w-[60%] xl:flex-1 xl:border-b-0 xl:border-r"
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2.5 sm:px-4 sm:py-3">
            <h3 className="truncate text-[11px] font-medium uppercase tracking-wide text-slate-500 sm:text-xs">
              Предпросмотр документа
            </h3>
          </div>

          {files.length > 1 && (
            <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-200 bg-white px-2 py-2 sm:px-3">
              {files.map((file, index) => (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => handleSelectFile(index)}
                  title={file.original_file_name || `Файл ${index + 1}`}
                  className={`cursor-pointer max-w-35 shrink-0 truncate rounded-lg px-2.5 py-1.5 text-[11px] transition sm:max-w-55 sm:px-3 sm:text-xs ${
                    index === selectedFileIndex
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span className="block truncate w-full text-left sm:text-center">
                    {file.original_file_name || `Файл ${index + 1}`}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {selectedFile ? (
              <FilePreviewPanel
                key={selectedFile.id}
                fileId={selectedFile.id}
                fileName={selectedFile.original_file_name}
                isOpen={isOpen && visible}
                onDownload={() => onDownload(selectedFile.id, selectedFile.original_file_name)}
              />
            ) : (
              <div className="flex flex-1 items-center justify-center p-4 text-sm text-slate-500 sm:p-6">
                Нет прикреплённых файлов
              </div>
            )}
          </div>
        </div>

        {/* Правая колонка — информация о заявке */}
        <div
          className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto overscroll-contain
            xl:w-[40%] xl:shrink-0 xl:max-h-none"
        >
          {doc && (
            <div className="space-y-3 p-4 pb-6 sm:space-y-4 sm:p-5 sm:pb-6 md:p-6">
              <div className="flex items-start justify-between gap-2 pr-10 sm:gap-3 sm:pr-12">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-slate-900 sm:text-lg">
                    {doc.student_name}
                  </h2>
                  <p className="text-xs text-slate-500 sm:text-sm">{doc.record_book}</p>
                </div>
                <span className="shrink-0 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 sm:px-3 sm:py-1 sm:text-sm">
                  +{doc.score}
                </span>
              </div>

              <div>
                <p className="mb-1 text-xs text-slate-800 sm:text-sm">Название достижения:</p>
                <textarea
                  readOnly
                  value={doc.achievement}
                  rows={4}
                  className="w-full resize-none rounded-xl bg-slate-50 p-3 text-xs text-slate-800 outline-none sm:p-4 sm:text-sm"
                />
              </div>

              <div className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-1">
                <div className="space-y-2">
                  <h3 className="text-[11px] font-medium uppercase tracking-wide text-slate-500 sm:text-xs">
                    О достижении:
                  </h3>
                  <div className="flex flex-col gap-1.5 sm:gap-2">
                    <p className="text-xs text-slate-800 sm:text-sm">
                      Категория:{' '}
                      <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 sm:text-sm">
                        {doc.category_display || '-'}
                      </span>
                    </p>
                    <p className="text-xs text-slate-800 sm:text-sm">
                      Подкатегория:{' '}
                      <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600 sm:text-sm">
                        {doc.sub_type_display || '-'}
                      </span>
                    </p>
                    {doc.level_display && (
                      <p className="text-xs text-slate-800 sm:text-sm">
                        Уровень:{' '}
                        <span className="inline-flex rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700 sm:text-sm">
                          {doc.level_display}
                        </span>
                      </p>
                    )}
                    {doc.result_display && (
                      <p className="text-xs text-slate-800 sm:text-sm">
                        Результат:{' '}
                        <span className="inline-flex rounded bg-purple-50 px-2 py-0.5 text-xs text-purple-700 sm:text-sm">
                          {doc.result_display}
                        </span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col">
                  <div className="mb-3 sm:mb-4">
                    <h3 className="text-[11px] font-medium uppercase tracking-wide text-slate-500 sm:text-xs">
                      Даты:
                    </h3>
                    <div className="mt-1 flex flex-col gap-1 text-xs text-slate-600 sm:text-sm">
                      <span>
                        <i className="fa-regular fa-calendar-check mr-1" />
                        Получения: {new Date(doc.date_received).toLocaleDateString('ru-RU')}
                      </span>
                      <span>
                        <i className="fa-regular fa-calendar mr-1" />
                        Загрузки: {new Date(doc.uploaded_at).toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                  </div>

                  {files.length > 0 && (
                    <div>
                      <h3 className="text-[11px] font-medium uppercase tracking-wide text-slate-500 sm:text-xs">
                        Документы:
                      </h3>
                      <p className="mt-1 text-xs text-slate-800 sm:text-sm">
                        Тип документа(-ов):{' '}
                        <span className="rounded-full bg-indigo-50 py-0.5 text-xs text-indigo-700 sm:text-sm">
                          {doc.doc_type_display || '-'}
                        </span>
                      </p>
                      <div className="flex flex-col gap-1 mt-2">
                        {doc.files.map((file, index) => (
                          <button
                            key={file.id}
                            onClick={() => onDownload(file.id, file.original_file_name)}
                            className="cursor-pointer flex cursor-pointer items-center gap-2 text-left text-sm text-sky-600 hover:text-sky-800"
                          >
                            <i className="fa-solid fa-file" />
                            <span>{file.original_file_name || `Файл ${index + 1}`}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {doc.rejection_reason && (
                <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700 sm:text-sm">
                  <span className="font-medium">Причина отклонения:</span> {doc.rejection_reason}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
