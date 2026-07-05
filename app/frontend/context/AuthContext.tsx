'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi } from '@/lib/apiRequests';
import { useRouter } from 'next/navigation';

import type { AuthUser, AuthContextValue, LoginFormData, RegisterFormData } from '@/interfaces/AuthInterfaces';

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

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

  // Short-polling
  const isStaff = user?.is_staff;
  const username = user?.username;
  useEffect(() => {
    if (!isStaff) return;

    const POLL_INTERVAL_MS = 15_000;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const fetchCount = () => {
      authApi.getPendingCount()
        .then(res => {
          const count = res.data.pending_docs_count;
          if (typeof count === 'number') {
            setUser(prev => (prev ? { ...prev, pending_docs_count: count } : prev));
          }
        })
        .catch(() => {}); // игнорируем
    };

    const startPolling = () => {
      if (intervalId === null) {
        intervalId = setInterval(fetchCount, POLL_INTERVAL_MS);
      }
    };

    const stopPolling = () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        fetchCount(); // синхронизация при возврате во вкладку
        startPolling();
      }
    };

    if (!document.hidden) {
      fetchCount();
      startPolling();
    }
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      stopPolling();
    };
  }, [isStaff, username]);

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
    setUser(res.data); 
    return res.data;
  };

  const logoutUser = async () => {
    await authApi.logout();
    setUser(null);
    router.push('/login');
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