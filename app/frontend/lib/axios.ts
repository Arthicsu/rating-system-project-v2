import axios from 'axios';
import toast from 'react-hot-toast';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true,
    validateStatus: () => true,
});

export const getErrorMessage = (error: unknown): string | null => {
  if (!error || typeof error !== 'object') return null;
  const response = (error as { response?: { data: unknown } }).response;
  const data = response?.data;
  if (!data || typeof data !== 'object') return null;
  if ('message' in data && data.message) return String(data.message);
  if ('detail' in data && data.detail) return String(data.detail);
  if (typeof data === 'object') {
    const messages = Object.values(data).flat().filter(Boolean);
    if (messages.length) return messages.join(', ');
  }
  return null;
};

export const getErrorStatus = (error: unknown): number | null => {
  if (!error || typeof error !== 'object') return null;
  return (error as { response?: { status: number } }).response?.status ?? null;
};

const redirectToErrorPage = (status: number, message?: string | null) => {
  if (typeof window === 'undefined') return;
  if (window.location.pathname.startsWith('/error/')) return;
  
  const params = new URLSearchParams();
  if (message) params.set('msg', message);
  
  const queryString = params.toString();
  window.location.href = `/error/${status}${queryString ? `?${queryString}` : ''}`;
};

api.interceptors.request.use((config) => {
  if (typeof document != 'undefined') {
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length == 2) return parts.pop()?.split(';').shift();
    };

    const csrfToken = getCookie('csrftoken');
    if (csrfToken) {
      config.headers['X-CSRFToken'] = csrfToken;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = getErrorStatus(error);
    const message = getErrorMessage(error);

    if (status === 401) {
      toast.error('Сессия истекла. Войдите снова.');
      window.location.href = '/login';
    } else if (status === 400) {
      toast.error(message || 'Некорректный запрос');
    } else if (status) {
      redirectToErrorPage(status, message);
    } else {
      toast.error('Ошибка соединения. Проверьте подключение.');
    }

    return Promise.reject(error);
  }
);

export default api;