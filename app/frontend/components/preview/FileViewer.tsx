'use client';

import { useMemo, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import type { FilePreviewKind } from '@/hooks/useFilePreview';

// Воркер pdf.js отдаётся статикой из public/ — работает одинаково и в webpack-dev,
// и в turbopack-build (Turbopack не резолвит bare-спецификатор в new URL()).
// ВАЖНО: public/pdf.worker.min.mjs скопирован из pdfjs-dist (сейчас 5.4.296).
// При обновлении react-pdf/pdfjs пересоздать файл:
//   cp node_modules/.pnpm/pdfjs-dist@<ver>/node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/pdf.worker.min.mjs
// Если версия воркера разойдётся с pdf.js — сработает мягкий фолбэк на <iframe>.
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const SCALE_STEP = 0.25;

const ctrlBtn =
  'cursor-pointer flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 active:scale-95 disabled:opacity-40 disabled:pointer-events-none';

interface FileViewerProps {
  previewUrl: string;
  previewKind: FilePreviewKind;
  fileName: string;
  onDownload: () => void;
}

/**
 * Единый просмотрщик файлов с одинаковыми элементами управления для всех типов:
 * приближение, поворот на 90° по часовой, скачивание оригинала, а для PDF —
 * постраничная навигация. PDF рендерится через pdf.js (управляемый зум/поворот);
 * если воркер недоступен — мягкий фолбэк на нативный просмотр в <iframe>.
 */
export default function FileViewer({ previewUrl, previewKind, fileName, onDownload }: FileViewerProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [pdfFailed, setPdfFailed] = useState(false);

  // Состояние сбрасывается само: FilePreviewPanel монтируется с key={file.id},
  // поэтому при смене файла FileViewer пересоздаётся с дефолтными значениями.

  const zoomIn = () => setScale((s) => Math.min(+(s + SCALE_STEP).toFixed(2), MAX_SCALE));
  const zoomOut = () => setScale((s) => Math.max(+(s - SCALE_STEP).toFixed(2), MIN_SCALE));
  const resetZoom = () => setScale(1);
  const rotateCw = () => setRotation((r) => (r + 90) % 360);

  const goToPage = (next: number) => setPageNumber(Math.min(Math.max(1, next), numPages || 1));

  const isPdf = previewKind === 'pdf';
  const usePdfRenderer = isPdf && !pdfFailed;
  const showPager = usePdfRenderer && numPages > 1;

  // Стабильная ссылка на источник, чтобы react-pdf не перезагружал документ при зуме/повороте.
  const fileSource = useMemo(() => previewUrl, [previewUrl]);

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col bg-slate-100">
      {/* ПАНЕЛЬ УПРАВЛЕНИЯ — одинаковая для всех типов файлов */}
      <div className="z-10 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2 shadow-sm select-none sm:px-4">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button type="button" onClick={zoomOut} disabled={scale <= MIN_SCALE} className={ctrlBtn} title="Уменьшить">
            <i className="fa-solid fa-magnifying-glass-minus" />
          </button>
          <span className="min-w-[52px] text-center text-xs font-semibold text-slate-600">
            {Math.round(scale * 100)}%
          </span>
          <button type="button" onClick={zoomIn} disabled={scale >= MAX_SCALE} className={ctrlBtn} title="Увеличить">
            <i className="fa-solid fa-magnifying-glass-plus" />
          </button>
          <button type="button" onClick={resetZoom} className={`${ctrlBtn} w-auto px-2 text-xs font-medium`} title="Сбросить масштаб">
            100%
          </button>

          <span className="mx-1 h-5 w-px bg-slate-200" />

          <button type="button" onClick={rotateCw} className={ctrlBtn} title="Повернуть на 90°">
            <i className="fa-solid fa-rotate-right" />
          </button>

          {showPager && (
            <>
              <span className="mx-1 h-5 w-px bg-slate-200" />
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => goToPage(pageNumber - 1)} disabled={pageNumber <= 1} className={ctrlBtn} title="Предыдущая страница">
                  <i className="fa-solid fa-chevron-left" />
                </button>
                <div className="flex items-center gap-1 text-xs font-medium text-slate-600">
                  <input
                    type="number"
                    min={1}
                    max={numPages}
                    value={pageNumber}
                    onChange={(e) => goToPage(Number(e.target.value))}
                    className="h-8 w-12 rounded-lg border border-slate-200 bg-white px-1 text-center text-xs text-slate-700 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  />
                  <span className="text-slate-400">/ {numPages}</span>
                </div>
                <button type="button" onClick={() => goToPage(pageNumber + 1)} disabled={pageNumber >= numPages} className={ctrlBtn} title="Следующая страница">
                  <i className="fa-solid fa-chevron-right" />
                </button>
              </div>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={onDownload}
          className="cursor-pointer flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-slate-800"
        >
          <i className="fa-solid fa-download" />
          <span className="hidden sm:inline">Скачать оригинал</span>
        </button>
      </div>

      {/* ОБЛАСТЬ КОНТЕНТА */}
      <div className="flex min-h-0 flex-1 justify-center overflow-auto p-4 sm:p-6">
        {/* PDF (включая сконвертированные .doc/.docx) */}
        {usePdfRenderer && (
          <Document
            file={fileSource}
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
            onLoadError={() => setPdfFailed(true)}
            loading={
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                <i className="fa-solid fa-spinner fa-spin mr-2" /> Загрузка документа…
              </div>
            }
            error={
              <div className="flex h-full items-center justify-center text-sm text-rose-600">
                Не удалось отрендерить PDF
              </div>
            }
            className="flex justify-center"
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              rotate={rotation}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              className="shadow-md"
              loading={
                <div className="flex h-[600px] items-center justify-center text-sm text-slate-400">
                  <i className="fa-solid fa-spinner fa-spin" />
                </div>
              }
            />
          </Document>
        )}

        {/* Фолбэк: нативный просмотр PDF, если pdf.js недоступен */}
        {isPdf && pdfFailed && (
          <iframe
            src={previewUrl}
            title={fileName}
            className="h-full w-full max-w-4xl rounded-lg border-0 bg-white shadow-md"
            style={{ minHeight: 600 }}
          />
        )}

        {/* Изображения */}
        {previewKind === 'image' && (
          <div className="flex h-full w-full items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt={fileName}
              className="max-h-full max-w-full rounded-md bg-white object-contain shadow-sm transition-transform duration-150"
              style={{ transform: `rotate(${rotation}deg) scale(${scale})` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
