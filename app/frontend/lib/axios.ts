import axios from 'axios';
import toast from 'react-hot-toast';
import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

declare module 'axios' {
  interface AxiosRequestConfig {
    /**
     * Подавляет глобальную обработку ошибок в интерсепторе ниже (тост на 429
     * и редирект на /login при 401): для фоновых запросов вроде поллинга
     * pending-count и скачивания/предпросмотра файлов, где протухшая сессия
     * не должна выдёргивать пользователя из текущего действия.
     */
    skipGlobalErrorHandling?: boolean;
  }
}

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

// Ручки аутентификации обрабатывают отказ сами: у анонима session-check
// штатно отвечает "не залогинен", а редирект отсюда зациклил бы /login.
const AUTH_URLS = ['/auth/session/', '/auth/login/', '/auth/logout/'];

// Дедупликация: пачка параллельных 403 от нескольких запросов страницы
// не должна порождать несколько проверок сессии подряд.
let sessionProbe: Promise<void> | null = null;

const redirectToLoginIfSessionDead = () => {
  if (sessionProbe) return;
  // DRF с сессионной аутентификацией на протухшую сессию отвечает 403
  // (не 401) и тем же кодом на реальную нехватку прав. Отличаем одно от
  // другого вопросом к /auth/session/: анониму она отдаёт 200
  // с isAuthenticated=false, живому пользователю - true.
  sessionProbe = api
    .get<{ isAuthenticated?: boolean }>('/api/v1/auth/session/', { skipGlobalErrorHandling: true })
    .then((r) => {
      if (!r.data?.isAuthenticated) {
        // Сессия истекла посреди работы. Полная навигация вместо router.push:
        // axios живёт вне React, а перезагрузка заодно сбрасывает кэш TanStack
        // и AuthContext. Сообщение показывает страница логина по ?expired=1,
        // тост отсюда не пережил бы выгрузку страницы.
        window.location.assign(
          '/login?next=' + encodeURIComponent(window.location.pathname) + '&expired=1'
        );
      }
    })
    .catch(() => undefined)
    .finally(() => {
      sessionProbe = null;
    });
};

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    const status = error.response?.status;
    const skipGlobalHandling = error.config?.skipGlobalErrorHandling;

    if (status === 429 && !skipGlobalHandling) {
      toast.error('Слишком много запросов - подождите немного и повторите.', { id: 'rate-limit' });
    }

    if ((status === 401 || status === 403) && !skipGlobalHandling && typeof window !== 'undefined') {
      const isAuthUrl = AUTH_URLS.some((u) => (error.config?.url ?? '').includes(u));
      if (!isAuthUrl && window.location.pathname !== '/login') {
        redirectToLoginIfSessionDead();
      }
    }
    return Promise.reject(error);
  }
);

export default api;
