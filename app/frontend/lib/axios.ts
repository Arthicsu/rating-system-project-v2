import axios from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

const ERROR_REDIRECT_CODES = [403, 429, 500, 502, 503];

const getCsrfToken = (): string | undefined => {
  if (typeof document === 'undefined') return undefined;
  
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'csrftoken') {
      return value;
    }
  }
  return undefined;
};

const api: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      config.headers.set('X-CSRFToken', csrfToken);
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    const status = error.response?.status;
    const isOnErrorPage = typeof window !== 'undefined' && window.location.pathname.startsWith('/error/');

    if (status && !isOnErrorPage && ERROR_REDIRECT_CODES.includes(status)) {
      const message = (error.response?.data as { detail?: string })?.detail || error.message;
      window.location.href = `/error/${status}?msg=${encodeURIComponent(message)}`;
    }
    return Promise.reject(error);
  }
);

export default api;