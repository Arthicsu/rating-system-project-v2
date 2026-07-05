import api from './axios';
import type { AuthUser, LoginFormData } from '@/interfaces/AuthInterfaces';
import type { Profile } from '@/interfaces/ProfileInterfaces';
import type { AchievementConfigResponse, AchievementUploadResponse } from '@/interfaces/AchievementInterfaces';
import type { RejectionReason, Semester, Group, FilterStudentsParams, DashboardStatsParams, DashboardStatsResponse, ReviewDocumentData, Document } from '@/interfaces/StaffInterfaces';
import type { FilterOptions, RatingParams, FilterParams, ExportExcelParams, CategoryAchievement } from '@/interfaces/RatingInterfaces';
import type Student from '@/interfaces/StudentInterfaces';

export const authApi = {
  checkAuth: () => api.get<AuthUser>('/api/v1/auth/session/'),

  login: (data: LoginFormData) => api.post<AuthUser>('/api/v1/auth/login/', data),

  // Саморегистрация отключена намеренно (backend-маршрут не подключён).
  // register: (data: RegisterFormData) => api.post<AuthUser>('/api/v1/auth/register/', data),

  logout: () => api.post('/api/v1/auth/logout/'),

  forgotPassword: (data: { email: string }) =>
    api.post<{ message: string }>('/api/v1/auth/forgot-password/', data),

  getPendingCount: () =>
    api.get<{ pending_docs_count: number }>('/api/v1/notifications/pending-count/', {
      skipErrorRedirect: true,
    }),
};

export const studentApi = {
  getProfile: () => api.get<Profile>('/api/v1/students/me/'),

  getProfileById: (id: string) => api.get<Profile>(`/api/v1/students/${id}/`),

  getAchievementDetail: (id: string | number) =>
    api.get<Document>(`/api/v1/achievements/${id}/`, { skipErrorRedirect: true }),

  getAchievementConfig: () => api.get<AchievementConfigResponse>('/api/v1/achievements/config/'),

  uploadAchievement: (formData: FormData) =>
    api.post<AchievementUploadResponse>('/api/v1/achievements/', formData, {headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000}),

  updateAchievement: (id: number, formData: FormData) =>
    api.patch(`/api/v1/achievements/${id}/`, formData, {headers: { 'Content-Type': 'multipart/form-data' },}),

  deleteAchievement: (id: number) => api.delete(`/api/v1/achievements/${id}/`),

  downloadDocument: (fileId: number) => api.get(`/api/v1/document-files/${fileId}/download/`, {
    responseType: 'blob',
  }),
};

export const universityApi = {
  getStaffProfile: () => api.get('/api/v1/staff/me/'),

  getRejectionReasons: () => api.get<RejectionReason[]>('/api/v1/rejection-reasons/'),

  getAcademicYears: () => api.get<Semester[]>('/api/v1/academic-years/'),

  getFilteredGroups: (params?: FilterParams) =>
    api.get<Group[]>('/api/v1/groups/', { params }),

  getFilteredStudents: (params: FilterStudentsParams) =>
    api.get<{ results: Student[]; count: number }>('/api/v1/students/', { params }),

  getFilteredDashboardStats: (params: DashboardStatsParams) =>
    api.get<DashboardStatsResponse>('/api/v1/achievements/', { params }),

  reviewDocument: (documentId: number, data: ReviewDocumentData) =>
    api.post(`/api/v1/achievements/${documentId}/review/`, data),

  exportRatingToExcel: (params?: ExportExcelParams) =>
    api.get('/api/v1/rating/export/', { params, responseType: 'blob' }),
};

export const userApi = {
  getCategoryAchievements: () => api.get<CategoryAchievement[]>('/api/v1/categories/'),

  getRatingFilters: () => api.get<FilterOptions>('/api/v1/rating/filters/'),

  getRating: (params: RatingParams) => api.get<{ results: Student[]; count: number }>('/api/v1/rating/', { params }),
};
