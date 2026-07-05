'use client';

import { useState } from 'react';
import api from '@/lib/axios';
import toast from 'react-hot-toast';
import type {ExportExcelButtonProps} from '@/interfaces/GeneralInterfaces'


export default function ExportExcelButton({ filters, category = 'common', page = 1 }: ExportExcelButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExportToExcel = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.faculty_id && filters.faculty_id !== 'all') params.append('faculty_id', filters.faculty_id);
      if (filters.course && filters.course !== 'all') params.append('course', filters.course);
      if (filters.group_id && filters.group_id !== 'all') params.append('group_id', filters.group_id);
      if (category !== 'common') params.append('category', category);
      params.append('page', String(page));
      
      const response = await api.get('/api/v1/rating/export/', {
        params,
        responseType: 'blob'
      });
      
      const disposition = response.headers['content-disposition'];
      const fileNameFromHeader = disposition?.match(/filename="?([^"]+)"?/)?.[1];
      const fileName = fileNameFromHeader || 'rating.xlsx';
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      window.URL.revokeObjectURL(downloadUrl);
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