import type { AuthUser } from '@/lib/api';

// Аугментация конфига axios (флаг skipGlobalErrorHandling) живёт
// в lib/axios.ts, рядом с самим интерсептором.

// Серверный DTO — из сгенерированных OpenAPI-типов (lib/api.ts).
export type { AuthUser } from '@/lib/api';

export interface AuthContextValue {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
  registerUser: (formData: RegisterFormData) => Promise<AuthUser>;
  loginUser: (formData: LoginFormData) => Promise<AuthUser>;
  logoutUser: () => Promise<void>;
  refreshUser: () => Promise<void>;
  loading: boolean;
}

export interface LoginFormData {
  username: string;
  password: string;
}

/** Единый тип формы регистрации (ранее дублировался с RegisterInterfaces.ts). */
export interface RegisterFormData {
  last_name: string;
  first_name: string;
  patronymic?: string;
  email: string;
  password: string;
  record_book?: string;
}

export interface AuthCheckResponse {
  isAuthenticated: boolean;
  username?: string;
  is_staff?: boolean;
  roles?: string[];
}
