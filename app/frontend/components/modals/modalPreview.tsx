'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { ModalPreviewProps } from '@/interfaces/ModalInterfaces';
import { useDownloadFile } from '@/hooks/useDownloadFile';
import FilePreviewPanel from '@/components/preview/FilePreviewPanel';

export default function ModalPreview({ isOpen, doc, onClose }: ModalPreviewProps) {
  const { downloadFile } = useDownloadFile();
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [seededDocId, setSeededDocId] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Сброс выбранной вкладки при открытии новой заявки — правкой состояния при
  // смене пропа (без setState в эффекте).
  if (doc && doc.id !== seededDocId) {
    setSeededDocId(doc.id);
    setSelectedFileIndex(0);
  }

  const handleClose = useCallback(() => {
    setVisible(false);
    setClosing(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onClose();
      setClosing(false);
      setSeededDocId(null);
    }, 200);
  }, [onClose]);

  const handleDownload = useCallback(
    (fileId: number, fileName: string) => {
      void downloadFile(fileId, fileName);
    },
    [downloadFile],
  );

  const handleSelectFile = useCallback((index: number) => {
    setSelectedFileIndex(index);
  }, []);

  // Сбрасываем выбранный файл при открытии новой заявки (корректировка состояния во время рендера).
  const fileIndexResetKey = `${isOpen}-${doc?.id}`;
  const [prevFileIndexResetKey, setPrevFileIndexResetKey] = useState(fileIndexResetKey);
  if (prevFileIndexResetKey !== fileIndexResetKey) {
    setPrevFileIndexResetKey(fileIndexResetKey);
    if (isOpen && doc) setSelectedFileIndex(0);
  }

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

    // Закрытие по Esc (внешний клик намеренно НЕ закрывает модалку).
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, handleClose]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!isOpen && !closing) return null;

  const files = doc?.files ?? [];
  const selectedFile = files[selectedFileIndex] ?? null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-3 md:p-5 transition-all duration-200 ${
        visible ? 'bg-slate-900/60' : 'bg-slate-900/0 pointer-events-none'
      }`}
      // Внешний клик намеренно не закрывает — закрытие только по кнопке или Esc.
    >
      <div
        className={`relative flex w-full flex-col overflow-hidden bg-white shadow-[0_18px_60px_rgba(15,23,42,0.35)] transform transition-all duration-200
          h-[100dvh] max-h-[100dvh] rounded-none
          sm:h-[92vh] sm:w-[95vw] sm:max-w-[1400px] sm:rounded-2xl sm:border sm:border-slate-100
          ${visible ? 'opacity-100 scale-100 sm:translate-y-0' : 'opacity-0 scale-95 sm:translate-y-2'}
        `}
      >
        {/* Шапка */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <i className="fa-solid fa-file-magnifying-glass text-sky-600" />
            <h3 className="truncate text-sm font-semibold text-slate-800">
              {selectedFile?.original_file_name || 'Предпросмотр документа'}
            </h3>
          </div>
          <button
            type="button"
            aria-label="Закрыть"
            className="cursor-pointer inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-xl text-slate-500 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-100 hover:text-slate-800"
            onClick={handleClose}
          >
            &times;
          </button>
        </div>

        {/* Вкладки файлов */}
        {files.length > 1 && (
          <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-200 bg-white px-2 py-2 sm:px-3">
            {files.map((file, index) => (
              <button
                key={file.id}
                type="button"
                onClick={() => handleSelectFile(index)}
                title={file.original_file_name || `Файл ${index + 1}`}
                className={`cursor-pointer max-w-40 min-w-0 shrink-0 overflow-hidden rounded-lg px-3 py-1.5 text-xs font-medium transition sm:max-w-60 ${
                  index === selectedFileIndex
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span className="block truncate">{file.original_file_name || `Файл ${index + 1}`}</span>
              </button>
            ))}
          </div>
        )}

        {/* Тело — просмотрщик */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {selectedFile ? (
            <FilePreviewPanel
              key={selectedFile.id}
              fileId={selectedFile.id}
              fileName={selectedFile.original_file_name}
              isOpen={isOpen && visible}
              onDownload={() => handleDownload(selectedFile.id, selectedFile.original_file_name)}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-sm text-slate-500">
              Нет прикреплённых файлов
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
