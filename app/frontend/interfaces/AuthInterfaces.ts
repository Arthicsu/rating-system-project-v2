declare module 'axios' {
  interface AxiosRequestConfig {
    skipErrorRedirect?: boolean;
  }
}

export interface AuthUser {
  user_id: number;
  username: string;
  record_book: string | null;
  isAuthenticated: boolean;
  is_staff: boolean;
  full_name: string;
  short_name: string;
  roles: string[];
  pending_docs_count: number;
}

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

export interface RegisterFormData {
  last_name: string;
  first_name: string;
  patronymic?: string;
  email: string;
  password: string;
}

export interface AuthCheckResponse {
  isAuthenticated: boolean;
  username?: string;
  is_staff?: boolean;
  roles?: string[];
}