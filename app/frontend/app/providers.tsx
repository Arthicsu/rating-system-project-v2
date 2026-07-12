'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import type { AxiosError } from 'axios';
// Реестр костей boneyard подключается именно из клиентского модуля: side-effect
// импорт client-файла из серверного layout.tsx в браузере не исполняется,
// registerBones не вызывался и скелетоны молча падали в fallback.
import '@/bones/registry';

/**
 * Клиентский провайдер TanStack Query (layout остаётся серверным компонентом).
 * QueryClient создаётся в useState-инициализаторе — один на всё время жизни приложения.
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            // Не рефетчим на фокус глобально (прежнее поведение страниц);
            // точечные исключения (pending-count) включают это сами.
            refetchOnWindowFocus: false,
            // 4xx не ретраим (401/403/404 не станут успехом), 5xx/сеть — один повтор.
            retry: (failureCount, error) => {
              const status = (error as AxiosError).response?.status;
              if (status && status >= 400 && status < 500) return false;
              return failureCount < 1;
            },
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
