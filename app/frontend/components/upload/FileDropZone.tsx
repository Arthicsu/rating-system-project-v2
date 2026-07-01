'use client';

import { useState, useRef, DragEvent } from 'react';
import toast from 'react-hot-toast';

interface FileDropZoneProps {
  files: File[];
  setFiles: React.Dispatch<React.SetStateAction<File[]>>;
}

const MAX_SIZE = 20 * 1024 * 1024; // 20 МБ
const ALLOWED_EXTENSIONS = ['doc', 'docx', 'pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'];

export default function FileDropZone({ files, setFiles }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Валидация с логикой ДОБАВЛЕНИЯ файлов
  const validateAndProcessFiles = (newFiles: File[]) => {
    // 1. Проверка расширений только для новых файлов
    const invalidFiles = newFiles.filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      return !ALLOWED_EXTENSIONS.includes(ext);
    });

    if (invalidFiles.length > 0) {
      toast.error(`Недопустимый формат: ${invalidFiles.map(f => f.name).join(', ')}`);
      return;
    }

    // 2. Проверка размера одиночного нового файла
    const oversized = newFiles.filter(f => f.size > MAX_SIZE);
    if (oversized.length > 0) {
      toast.error(`Файл(ы) превышают 20 МБ: ${oversized.map(f => f.name).join(', ')}`);
      return;
    }

    // 3. Фильтруем дубликаты (чтобы не добавить один и тот же файл дважды)
    const uniqueNewFiles = newFiles.filter(
      newFile => !files.some(existing => existing.name === newFile.name && existing.size === newFile.size)
    );

    if (uniqueNewFiles.length === 0 && newFiles.length > 0) {
      toast.error("Этот файл уже добавлен в список");
      return;
    }

    // 4. Проверяем лимит на количество (максимум 3 в сумме)
    const totalCountAfterAdd = files.length + uniqueNewFiles.length;
    
    if (totalCountAfterAdd > 3) {
      const allowedSlots = 3 - files.length;
      if (allowedSlots <= 0) {
        toast.error("Максимум можно загрузить 3 файла. Удалите что-то из списка.");
        return;
      }
      
      toast.error(`Максимум можно  добавить файлов: ${allowedSlots}. Лишние отсечены.`);
      
      // Берем только то количество, которое влезает в лимит
      const slicedNewFiles = uniqueNewFiles.slice(0, allowedSlots);
      const combined = [...files, ...slicedNewFiles];
      
      // Проверяем общий размер для урезанного списка
      const totalSize = combined.reduce((sum, f) => sum + f.size, 0);
      if (totalSize > MAX_SIZE) {
        toast.error("Общий размер файлов превышает 20 МБ");
        return;
      }
      
      setFiles(combined);
      return;
    }

    // 5. Проверяем общий размер всех файлов вместе (старых + новых)
    const combinedFiles = [...files, ...uniqueNewFiles];
    const totalSize = combinedFiles.reduce((sum, f) => sum + f.size, 0);
    
    if (totalSize > MAX_SIZE) {
      toast.error("Общий размер всех загруженных файлов превышает 20 МБ");
      return;
    }

    // Если всё ок — сохраняем объединенный массив
    setFiles(combinedFiles);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      validateAndProcessFiles(droppedFiles);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    validateAndProcessFiles(selected);
    
    // Сбрасываем значение инпута, чтобы можно было удалить файл и выбрать его же заново через проводник
    if (e.target) e.target.value = '';
  };

  const removeFile = (indexToRemove: number) => {
    setFiles(prev => prev.filter((_, i) => i !== indexToRemove));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="w-full space-y-3">
      <input
        type="file"
        ref={fileInputRef}
        multiple
        accept=".doc,.docx,.pdf,.png,.jpg,.jpeg,.webp,.gif,.bmp"
        className="hidden"
        onChange={handleFileChange}
      />

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`group relative flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-5 text-center transition-all duration-200
          ${isDragging 
            ? 'border-sky-500 bg-sky-50/50 scale-[0.99]' 
            : 'border-slate-300 bg-slate-50 hover:border-sky-400 hover:bg-slate-100/70'
          }`}
      >
        <div className={`mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200 transition-colors
          ${isDragging ? 'text-sky-700 bg-sky-50' : 'text-sky-700 group-hover:text-sky-700'}`}
        >
          <i className={`fa-solid text-lg ${isDragging ? 'fa-file-arrow-up fa-bounce' : 'fa-cloud-arrow-up'}`} />
        </div>
        
        <p className="text-xs font-medium text-slate-700">
          Перетащите файлы сюда или <span className="text-sky-700 group-hover:text-sky-600 font-semibold">выберите на компьютере</span>
        </p>
        <p className="mt-1 text-[10px] text-sky-700 max-w-xs">
          До 3-х файлов по очереди или вместе. Общий размер до 20 МБ.
        </p>
      </div>

      {files.length > 0 && (
        <div className="space-y-2 animate-in fade-in duration-200">
          {files.map((file, index) => (
            <div 
              key={index} 
              className="flex items-center justify-between rounded-lg border border-slate-100 bg-white shadow-sm p-2.5 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <i className="fa-solid fa-file-lines text-sky-700 text-sm shrink-0" />
                <span className="truncate font-medium text-sky-700">{file.name}</span>
                <span className="text-sky-700 shrink-0">({formatFileSize(file.size)})</span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(index);
                }}
                className="cursor-pointer p-1 text-slate-400 hover:text-rose-500 rounded-full hover:bg-slate-100 transition"
                title="Удалить"
              >
                <i className="fa-solid fa-xmark text-sm" />
              </button>
            </div>
          ))}
          {files.length === 3 && (
            <p className="text-[10px] text-amber-600 flex items-center gap-1">
              <i className="fa-solid fa-triangle-exclamation" /> Достигнут лимит в 3 файла
            </p>
          )}
        </div>
      )}
    </div>
  );
}