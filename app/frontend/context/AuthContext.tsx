'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import api from '@/lib/axios';
import { useRouter } from 'next/navigation';
import type { AuthUser, AuthContextValue, LoginFormData, RegisterFormData } from '@/interfaces/AuthInterfaces';

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    api.get('/user/api/v1/check-auth/')
      .then(res => {
        if (res.data.isAuthenticated) {
          setUser(res.data);
        }
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const registerUser = async (formData: RegisterFormData) => {
    const res = await api.post('/user/api/v1/register/student/', formData);
    setUser(res.data); 
    return res.data;
  };

  const loginUser = async (formData: LoginFormData) => {
    const res = await api.post('/user/api/v1/login/', formData);
    setUser(res.data); 
    return res.data;
  };

  const logoutUser = async () => {
    await api.post('/user/api/v1/logout/');
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, setUser, registerUser, loginUser, logoutUser, loading }}>
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