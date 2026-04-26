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

  const registerUser = async (formData: RegisterFormData) => {
    const res = await authApi.register(formData);
    setUser(res.data); 
    return res.data;
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