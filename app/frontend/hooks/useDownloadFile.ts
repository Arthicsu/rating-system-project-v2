import toast from 'react-hot-toast';
import { studentApi } from '@/lib/apiRequests';

/** Сохраняет blob на диск через временную ссылку. */
export function saveBlob(data: BlobPart, fileName: string) {
  const url = window.URL.createObjectURL(new Blob([data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export function useDownloadFile() {
  const downloadFile = async (fileId: number, fileName: string) => {
    try {
      const response = await studentApi.downloadDocument(fileId);
      saveBlob(response.data, fileName);
    } catch (error) {
      console.error('Ошибка скачивания файла:', error);
      toast.error('Не удалось скачать файл');
    }
  };

  return { downloadFile };
}
