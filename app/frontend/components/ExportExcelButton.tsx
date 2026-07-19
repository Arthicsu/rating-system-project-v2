'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { universityApi } from '@/lib/apiRequests';
import { saveBlob } from '@/hooks/useDownloadFile';
import type {ExportExcelButtonProps} from '@/interfaces/GeneralInterfaces'


export default function ExportExcelButton({ filters, category = 'common', page = 1 }: ExportExcelButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExportToExcel = async () => {
    setLoading(true);
    try {
      // undefined-параметры axios не отправляет: 'all'/'common' — это «без фильтра».
      const response = await universityApi.exportRatingToExcel({
        faculty_id: filters.faculty_id !== 'all' ? filters.faculty_id : undefined,
        course: filters.course !== 'all' ? filters.course : undefined,
        group_id: filters.group_id !== 'all' ? filters.group_id : undefined,
        category: category !== 'common' ? category : undefined,
        page,
      });

      const disposition = response.headers['content-disposition'];
      const fileNameFromHeader = disposition?.match(/filename="?([^"]+)"?/)?.[1];
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
