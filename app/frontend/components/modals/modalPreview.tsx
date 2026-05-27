'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import type { ModalPreviewProps } from '@/interfaces/ModalInterfaces'

export default function ModalPreview({ isOpen, doc, onClose, onDownload }: ModalPreviewProps) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen && !closing) {
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
  }, [isOpen, closing]);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
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

  return (
    <div
      className={`fixed inset-0 z-40 flex items-center justify-center px-4 py-6 sm:px-0 transition-all duration-200 ${
        visible ? 'bg-slate-900/60' : 'bg-slate-900/0 pointer-events-none'
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className={`relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.35)] sm:p-6 transform transition-all duration-200 ${
        visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
      }`}>
        <button
          type="button"
          className="cursor-pointer absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full text-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          onClick={handleClose}
        >
          &times;
        </button>

        {doc && (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{doc.student_name}</h2>
              <p className="text-sm text-slate-500">{doc.record_book}</p>
            </div>
            <div className="flex shrink-0 items-center">
              <span className="rounded-full border tracking-wide border-emerald-100 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700 mr-8">
                +{doc.score}
              </span>
            </div>
          </div>
          <p className="text-sm text-slate-800">Название достижения:</p>
          <textarea
            readOnly
            value={doc.achievement}
            rows={4}
            className="w-full resize-none rounded-xl bg-slate-50 p-4 text-sm text-slate-800 outline-none"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">О достижении:</h3>
              <div className="flex flex-col gap-2">
                <p className="text-sm text-slate-800">Категория:{' '}
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-sm font-medium text-amber-700">
                    {doc.category_display || '-'}
                  </span>
                </p>
                <p className="text-sm text-slate-800">Подкатегория:{' '}
                  <span className="rounded bg-slate-100 px-2 py-1 text-sm text-slate-600">
                    {doc.sub_type_display || '-'}
                  </span>
                </p>
                {doc.level_display && (
                  <p className="text-sm text-slate-800">Уровень:{' '}
                    <span className="inline-flex rounded bg-blue-50 px-2 py-1 text-sm text-blue-700">
                      {doc.level_display || '-'}
                    </span>
                  </p>
                )}
                {doc.result_display && (
                  <p className="text-sm text-slate-800">Результат:{' '}
                    <span className="inline-flex rounded bg-purple-50 px-2 py-1 text-sm text-purple-700">
                      {doc.result_display || '-'}
                    </span>
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col">
              <div className="mb-4">
                <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">Даты:</h3>
                <div className="flex flex-col gap-1 text-sm text-slate-600 mt-1">
                  <span><i className="fa-regular fa-calendar-check mr-1" />Получения: {new Date(doc.date_received).toLocaleDateString('ru-RU')}</span>
                  <span><i className="fa-regular fa-calendar mr-1" />Загрузки: {new Date(doc.uploaded_at).toLocaleDateString('ru-RU')}</span>
                </div>
              </div>
              {doc.files && doc.files.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">Документы:</h3>
                  <p className="text-sm text-slate-800 mt-1">Тип документа(-ов):{' '}
                    <span className="rounded-full bg-indigo-50 py-1 text-sm font-small text-indigo-700">
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
            <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
              <span className="font-medium">Причина отклонения:</span> {doc.rejection_reason}
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
