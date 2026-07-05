import toast from 'react-hot-toast';
import api from '@/lib/axios';

export function useDownloadFile() {
  const downloadFile = async (fileId: number, fileName: string) => {
    try {
      const response = await api.get(`/api/v1/document-files/${fileId}/download/`, {
        responseType: 'blob',
        skipErrorRedirect: true,
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();

      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Ошибка скачивания файла:', error);
      toast.error('Не удалось скачать файл');
    }
  };

  return { downloadFile };
}
