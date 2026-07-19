'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { universityApi } from '@/lib/apiRequests';
import { saveBlob } from '@/hooks/useDownloadFile';
import type { ExportExcelButtonProps } from '@/interfaces/GeneralInterfaces';

/** Имя файла из Content-Disposition: сперва RFC 5987 (filename*, кириллица), затем обычный filename. */
function fileNameFromDisposition(disposition?: string) {
  const utf8 = disposition?.match(/filename\*=utf-8''([^;]+)/i)?.[1];
  if (utf8) {
    try {
      return decodeURIComponent(utf8);
    } catch {
      // Некорректная кодировка в заголовке: используем запасное имя.
    }
  }
  return disposition?.match(/filename="?([^";]+)"?/)?.[1];
}

export default function ExportExcelButton({
  faculty_id,
  course,
  group_id,
  category = 'common',
  academic_year,
  direction,
  page = 1,
}: ExportExcelButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExportToExcel = async () => {
    setLoading(true);
    try {
      // undefined-параметры axios не отправляет: 'all'/'common' — это «без фильтра».
      const response = await universityApi.exportRatingToExcel({
        faculty_id: faculty_id !== 'all' ? faculty_id : undefined,
        course: course !== 'all' ? course : undefined,
        group_id: group_id !== 'all' ? group_id : undefined,
        category: category !== 'common' ? category : undefined,
        academic_year,
        direction,
        page,
      });

      const fileNameFromHeader = fileNameFromDisposition(response.headers['content-disposition']);
      saveBlob(response.data, fileNameFromHeader || 'rating.xlsx');
    } catch (error) {
      console.error('Ошибка при выгрузке Excel:', error);
      toast.error('Не удалось выгрузить Excel файл');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleExportToExcel}
      disabled={loading}
      className="cursor-pointer inline-flex items-center rounded-md bg-emerald-600 px-2 py-1 text-[10px] sm:px-3 sm:py-1.5 sm:text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 transition shadow-emerald-300 shadow-lg"
    >
      {loading ? 'Выгрузка...' : <>
        <span className="sm:hidden">Excel</span>
        <span className="hidden sm:inline">Выгрузить в Excel</span>
      </>}
    </button>
  );
}
