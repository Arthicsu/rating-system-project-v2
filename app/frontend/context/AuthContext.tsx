'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/lib/apiRequests';
import { useRouter } from 'next/navigation';

import type { AuthUser, AuthContextValue, LoginFormData, RegisterFormData } from '@/interfaces/AuthInterfaces';

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const queryClient = useQueryClient();

  const fetchUser = useCallback(() => {
    return authApi.checkAuth()
      .then(res => {
        if (res.data.isAuthenticated) {
          setUser(res.data);
        } else {
          setUser(null);
        }
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Поллинг счётчика заявок живёт в hooks/queries.ts (usePendingCount)
  // (TanStack Query: refetchInterval 15с + пауза на скрытой вкладке); badge читает Header.

  const registerUser = async (formData: RegisterFormData) => {
    // Саморегистрация отключена (backend-маршрут не подключён); страница
    // регистрации скрыта из роутинга (app/_register). Код сохранён намеренно.
    // const res = await authApi.register(formData);
    // setUser(res.data);
    // return res.data;
    void formData;
    throw new Error('Регистрация отключена');
  };

  const loginUser = async (formData: LoginFormData) => {
    const res = await authApi.login(formData);
    // Ключи запросов не содержат id пользователя: без очистки новый пользователь
    // до 30 с (staleTime) видел бы закэшированные списки предыдущего, например
    // кафедра - очередь заявок ректората, пока поллинг не перезапросит данные.
    queryClient.clear();
    setUser(res.data);
    return res.data;
  };

  const logoutUser = async () => {
    try {
      await authApi.logout();
    } catch {
      // Сервер недоступен или сессия уже погашена: локальный выход всё равно
      // выполняем, иначе пользователь застрянет "залогиненным" без сессии.
    }
    setUser(null);
    router.push('/login');
    // Данные вышедшего пользователя не должны остаться в памяти вкладки
    // (общий компьютер кафедры). Полная перезагрузка, как в интерсепторе
    // axios, тоже сбросила бы кэш, но выход остаётся SPA-навигацией.
    queryClient.clear();
  };

  return (
    <AuthContext.Provider value={{ user, setUser, registerUser, loginUser, logoutUser, refreshUser: fetchUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useMySession = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useMySession must be used within AuthProvider');
  }
  return context;
};