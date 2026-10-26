import type { DocumentFileDto } from '@/lib/api';

interface AchievementFilesProps {
  files: DocumentFileDto[];
  onDownload: (fileId: number, fileName: string) => void;
}

/** Список прикреплённых файлов со скачиванием. */
export default function AchievementFiles({ files, onDownload }: AchievementFilesProps) {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Файлы</h2>
      {files.length > 0 ? (
        <ul className="flex flex-col">
          {files.map((file, index) => {
            const name = file.original_file_name || `Файл ${index + 1}`;
            return (
              <li key={file.id} className="min-w-0">
                <button
                  type="button"
                  onClick={() => onDownload(file.id, name)}
                  className="flex min-h-11 w-full min-w-0 cursor-pointer items-center gap-2 text-left text-sm text-sky-700 transition hover:text-sky-900"
                >
                  <i className="fa-solid fa-download shrink-0" aria-hidden="true" />
                  <span className="truncate">{name}</span>
                  <span className="sr-only">— скачать</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-slate-600">К заявке не прикреплены файлы.</p>
      )}
    </section>
  );
}
