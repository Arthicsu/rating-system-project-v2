import { useEffect, useRef, useState } from 'react';
import api from '@/lib/axios';

export type FilePreviewKind = 'pdf' | 'image' | 'docx' | 'unsupported';

export function getFilePreviewKind(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'docx') return 'docx'; 
  
  return 'unsupported';
}

export function useFilePreview(fileId: number | null, enabled: boolean) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const revokeCurrentUrl = () => {
      if (objectUrlRef.current) {
        window.URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };

    if (!enabled || fileId === null) {
      revokeCurrentUrl();
      setPreviewUrl(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadPreview = async () => {
      revokeCurrentUrl();
      setPreviewUrl(null);
      setLoading(true);
      setError(null);

      try {
        const response = await api.get(`/student/api/v1/document/download/${fileId}/`, {
          responseType: 'blob',
          skipErrorRedirect: true,
          timeout: 30000,
        });

        if (cancelled) return;

        const objectUrl = window.URL.createObjectURL(response.data);
        objectUrlRef.current = objectUrl;
        setPreviewUrl(objectUrl);
      } catch {
        if (!cancelled) {
          setError('Не удалось загрузить файл для предпросмотра');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPreview();

    return () => {
      cancelled = true;
      revokeCurrentUrl();
    };
  }, [fileId, enabled]);

  return { previewUrl, loading, error };
}
