'use client';

import FilePreviewPanel from '@/components/preview/FilePreviewPanel';
import type { DocumentFileDto } from '@/lib/api';

interface AchievementPreviewPaneProps {
  files: DocumentFileDto[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onFullscreen: () => void;
  onDownload: (fileId: number, fileName: string) => void;
}

/** Предпросмотр файлов заявки: вкладки файлов, панель просмотра и кнопка «На весь экран». */
export default function AchievementPreviewPane({
  files,
  selectedIndex,
  onSelect,
  onFullscreen,
  onDownload,
}: AchievementPreviewPaneProps) {
  const selectedFile = files[selectedIndex] ?? files[0] ?? null;

  return (
    <div className="flex h-[80vh] min-h-[500px] flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm lg:h-[calc(120vh-10rem)]">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <i className="fa-solid fa-file-magnifying-glass text-sky-700" aria-hidden="true" />
          <span className="truncate text-sm font-semibold text-slate-800">
            {selectedFile?.original_file_name || 'Предпросмотр документа'}
          </span>
        </div>
        <button
          type="button"
          onClick={onFullscreen}
          className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
          aria-label="Открыть на весь экран"
        >
          <i className="fa-solid fa-expand" aria-hidden="true" />
          <span className="hidden sm:inline">На весь экран</span>
        </button>
      </div>

      {files.length > 1 && (
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-200 bg-white px-2 py-2 sm:px-3">
          {files.map((file, index) => (
            <button
              key={file.id}
              type="button"
              onClick={() => onSelect(index)}
              aria-pressed={index === selectedIndex}
              title={file.original_file_name || `Файл ${index + 1}`}
              className={`max-w-40 min-w-0 shrink-0 cursor-pointer overflow-hidden rounded-lg px-3 py-2 text-xs font-medium transition sm:max-w-60 ${
                index === selectedIndex ? 'bg-sky-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
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
            onDownload={() => onDownload(selectedFile.id, selectedFile.original_file_name ?? '')}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-sm text-slate-600">Нет прикреплённых файлов</div>
        )}
      </div>
    </div>
  );
}
