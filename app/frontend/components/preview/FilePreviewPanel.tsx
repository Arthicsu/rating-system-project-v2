'use client';

import dynamic from 'next/dynamic';
import Button from '@/components/Button';
import { useFilePreview, getFilePreviewKind } from '@/hooks/useFilePreview';
import Spinner from '@/components/Spinner';

// pdf.js (внутри FileViewer) не должен исполняться на сервере — грузим только на клиенте.
const FileViewer = dynamic(() => import('@/components/preview/FileViewer'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full flex-1 items-center justify-center p-6 text-sm text-slate-500">
      <Spinner label="Загрузка просмотрщика…" visibleLabel />
    </div>
  ),
});

interface FilePreviewPanelProps {
  fileId: string;
  fileName: string;
  /** Загружать превью только когда панель реально видна (модалка открыта/страница смонтирована). */
  isOpen: boolean;
  onDownload: () => void;
}

/**
 * Панель предпросмотра одного файла: подгружает blob по fileId и рендерит
 * универсальный FileViewer (PDF/изображения) либо состояние ошибки/недоступности.
 *
 * Состояние зума/страниц живёт внутри FileViewer и сбрасывается за счёт монтирования
 * панели с key={file.id} у вызывающей стороны.
 */
export default function FilePreviewPanel({ fileId, fileName, isOpen, onDownload }: FilePreviewPanelProps) {
  const { previewUrl, loading, error } = useFilePreview(fileId, isOpen);
  const previewKind = getFilePreviewKind(fileName);

  if (!isOpen) {
    return <div className="flex h-full flex-1" />;
  }

  if (loading) {
    return (
      <div className="flex h-full flex-1 items-center justify-center p-6 text-sm text-slate-500">
        <Spinner label="Загрузка предпросмотра…" visibleLabel />
      </div>
    );
  }

  if (error || !previewUrl || previewKind === 'unsupported') {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        {previewKind === 'unsupported' ? (
          <>
            <i className="fa-solid fa-file text-4xl text-slate-400" />
            <p className="max-w-xs text-sm text-slate-600">Предпросмотр недоступен для этого типа файла</p>
          </>
        ) : (
          <p className="text-sm text-rose-600">{error ?? 'Не удалось загрузить файл для предпросмотра'}</p>
        )}
        <Button onClick={onDownload}>Скачать файл</Button>
      </div>
    );
  }

  return (
    <FileViewer previewUrl={previewUrl} previewKind={previewKind} fileName={fileName} onDownload={onDownload} />
  );
}
