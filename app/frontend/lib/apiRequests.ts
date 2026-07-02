import api from './axios';
import type { AuthUser, LoginFormData, RegisterFormData } from '@/interfaces/AuthInterfaces';
import type { Profile } from '@/interfaces/ProfileInterfaces';
import type { AchievementConfigResponse, AchievementUploadResponse } from '@/interfaces/AchievementInterfaces';
import type { RejectionReason, Semester, Group, FilterStudentsParams, DashboardStatsParams, DashboardStatsResponse, ReviewDocumentData } from '@/interfaces/StaffInterfaces';
import type { FilterOptions, RatingParams, FilterParams, ExportExcelParams, CategoryAchievement } from '@/interfaces/RatingInterfaces';
import type Student from '@/interfaces/StudentInterfaces';

export const authApi = {
  checkAuth: () => api.get<AuthUser>('/user/api/v1/check-auth/'),
  
  login: (data: LoginFormData) => api.post<AuthUser>('/user/api/v1/login/', data),
  
  register: (data: RegisterFormData) => api.post<AuthUser>('/user/api/v1/register/student/', data),
  
  logout: () => api.post('/user/api/v1/logout/'),

  forgotPassword: (data: { email: string }) =>
    api.post<{ message: string }>('/user/api/v1/forgot-password/', data),

  getPendingCount: () =>
    api.get<{ pending_docs_count: number }>('/api/v1/notifications/pending-count/', {
      skipErrorRedirect: true,
    }),
};

export const studentApi = {
  getProfile: () => api.get<Profile>('/student/api/v1/profile/'),
  
  getProfileById: (id: string) => api.get<Profile>(`/student/api/v1/profile/${id}/`),
  
  getAchievementConfig: () => api.get<AchievementConfigResponse>('/student/api/v1/achievement-config/'),
  
  uploadAchievement: (formData: FormData) =>
    api.post<AchievementUploadResponse>('/student/api/v1/upload/', formData, {headers: { 'Content-Type': 'multipart/form-data' }}),

  updateAchievement: (id: number, formData: FormData) =>
    api.patch(`/student/api/v1/achievement/${id}/`, formData, {headers: { 'Content-Type': 'multipart/form-data' },}),

  deleteAchievement: (id: number) => api.delete(`/student/api/v1/achievement/${id}/`),

  downloadDocument: (fileId: number) => api.get(`/student/api/v1/document/download/${fileId}/`, {
    responseType: 'blob',
  }),
};

export const universityApi = {
  getStaffProfile: () => api.get('/university/api/v1/staff-profile/'),
  
  getRejectionReasons: () => api.get<RejectionReason[]>('/university/api/v1/rejection-reasons/'),
  
  getAcademicYears: () => api.get<Semester[]>('/university/api/v1/academic-years/'),
  
  getFilteredGroups: (params?: FilterParams) => 
    api.get<Group[]>('/university/api/v1/filtered-groups/', { params }),
  
  getFilteredStudents: (params: FilterStudentsParams) =>
    api.get<{ results: Student[]; count: number }>('/university/api/v1/filtered-students/', { params }),
  
  getFilteredDashboardStats: (params: DashboardStatsParams) =>
    api.get<DashboardStatsResponse>('/university/api/v1/filtered-dashboard-stats/', { params }),
  
  reviewDocument: (documentId: number, data: ReviewDocumentData) =>
    api.post(`/university/api/v1/document/${documentId}/review/`, data),
  
  exportRatingToExcel: (params?: ExportExcelParams) =>
    api.get('/university/api/v1/export-rating-to-excel/', { params, responseType: 'blob' }),
};

export const userApi = {
  getCategoryAchievements: () => api.get<CategoryAchievement[]>('/user/api/v1/category-achievements/'),
  
  getRatingFilters: () => api.get<FilterOptions>('/user/api/v1/rating-filters/'),
  
  getRating: (params: RatingParams) => api.get<{ results: Student[]; count: number }>('/user/api/v2/rating/', { params }),
};