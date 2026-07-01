'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { PreviewDocument } from '@/interfaces/ModalInterfaces';

interface AchievementInfoPanelProps {
  doc: PreviewDocument | null;
  onClose: () => void;
  onPreview: () => void;
  onDownload: (fileId: number, fileName: string) => void;
}

/**
 * Боковая панель (drawer) с полной информацией о достижении.
 * Открывается на staff-странице по «Подробнее»; предпросмотр файлов выносится
 * в отдельную большую модалку (кнопка «Предпросмотр документов»).
 */
export default function AchievementInfoPanel({ doc, onClose, onPreview, onDownload }: AchievementInfoPanelProps) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOpen = !!doc;

  const handleClose = useCallback(() => {
    setVisible(false);
    setClosing(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onClose();
      setClosing(false);
    }, 200);
  }, [onClose]);

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

  return (
    <div
      className={`fixed inset-0 z-40 flex justify-end transition-all duration-200 ${
        visible ? 'bg-slate-900/60' : 'bg-slate-900/0 pointer-events-none'
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <aside
        className={`flex h-full w-full max-w-md flex-col bg-white shadow-[0_18px_60px_rgba(15,23,42,0.35)] transition-transform duration-200 sm:max-w-lg ${
          visible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {doc && (
          <>
            {/* Шапка */}
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold text-slate-900 sm:text-xl">{doc.student_name}</h2>
                <p className="text-sm text-slate-500">{doc.record_book}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
                  +{doc.score}
                </span>
                <button
                  type="button"
                  aria-label="Закрыть"
                  onClick={handleClose}
                  className="cursor-pointer inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-xl text-slate-500 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-100 hover:text-slate-800"
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Контент */}
            <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain p-5">
              {/* Доп. информация (название достижения и т.п.) */}
              <div>
                <p className="mb-1.5 text-sm font-medium text-slate-800">
                  Дополнительная информация (например, название достижения и т.п.)
                </p>
                <div className="rounded-xl bg-slate-50 p-4 text-base leading-relaxed whitespace-pre-wrap text-slate-800">
                  {doc.achievement || '—'}
                </div>
              </div>

              {/* О достижении */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">О достижении</h3>
                <div className="flex flex-col gap-2 text-sm text-slate-800">
                  <p>
                    Категория:{' '}
                    <span className="inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-medium text-amber-700">
                      {doc.category_display || '-'}
                    </span>
                  </p>
                  <p>
                    Подкатегория:{' '}
                    <span className="inline-block rounded bg-slate-100 px-2.5 py-0.5 text-sm text-slate-600">
                      {doc.sub_type_display || '-'}
                    </span>
                  </p>
                  {doc.level_display && (
                    <p>
                      Уровень:{' '}
                      <span className="inline-flex rounded bg-blue-50 px-2.5 py-0.5 text-sm text-blue-700">
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
              </div>

              {/* Даты */}
              <div className="space-y-1.5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Даты</h3>
                <div className="flex flex-col gap-1 text-sm text-slate-600">
                  <span>
                    <i className="fa-regular fa-calendar-check mr-1.5" />
                    Получения: {new Date(doc.date_received).toLocaleDateString('ru-RU')}
                  </span>
                  <span>
                    <i className="fa-regular fa-calendar mr-1.5" />
                    Загрузки: {new Date(doc.uploaded_at).toLocaleDateString('ru-RU')}
                  </span>
                </div>
              </div>

              {/* Документы */}
              {files.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Документы</h3>
                  <p className="text-sm text-slate-800">
                    Тип документа(-ов):{' '}
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-sm text-indigo-700">
                      {doc.doc_type_display || '-'}
                    </span>
                  </p>
                  <div className="mt-1 flex flex-col gap-1.5">
                    {files.map((file, index) => (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => onDownload(file.id, file.original_file_name)}
                        className="cursor-pointer flex items-center gap-2 text-left text-sm text-sky-600 transition hover:text-sky-800"
                      >
                        <i className="fa-solid fa-file" />
                        <span className="truncate">{file.original_file_name || `Файл ${index + 1}`}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {doc.rejection_reason && (
                <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
                  <span className="font-medium">Причина отклонения:</span> {doc.rejection_reason}
                </div>
              )}
            </div>

            {/* Действия */}
            {files.length > 0 && (
              <div className="shrink-0 border-t border-slate-200 bg-white p-4">
                <button
                  type="button"
                  onClick={onPreview}
                  className="cursor-pointer inline-flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
                >
                  <i className="fa-solid fa-file-magnifying-glass" />
                  Предпросмотр документов
                </button>
              </div>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
