import api from './axios';
import type {
  AcademicYearDto,
  AuthUser,
  CategoryDto,
  DashboardStatsResponse,
  GroupDto,
  MessageDto,
  Paginated,
  PendingCountDto,
  PendingDocumentDto,
  Profile,
  RatingFiltersResponseDto,
  RejectionReasonDto,
  ReviewDocumentRequestDto,
  StaffProfileResponseDto,
  StudentProfileDto,
  StudentRatingDto,
} from '@/lib/api';
import type { LoginFormData } from '@/interfaces/AuthInterfaces';
import type { FilterStudentsParams, DashboardStatsParams } from '@/interfaces/StaffInterfaces';
import type { AchievementConfigResponse } from '@/interfaces/AchievementInterfaces';
import type { RatingParams, FilterParams, ExportExcelParams } from '@/interfaces/RatingInterfaces';

export const authApi = {
  checkAuth: () => api.get<AuthUser>('/api/v1/auth/session/'),

  login: (data: LoginFormData) => api.post<AuthUser>('/api/v1/auth/login/', data),

  // Саморегистрация отключена намеренно (backend-маршрут не подключён).
  // register: (data: RegisterFormData) => api.post<AuthUser>('/api/v1/auth/register/', data),

  logout: () => api.post('/api/v1/auth/logout/'),

  forgotPassword: (data: { email: string }) =>
    api.post<MessageDto>('/api/v1/auth/forgot-password/', data),

  getPendingCount: () =>
    api.get<PendingCountDto>('/api/v1/notifications/pending-count/', {
      skipErrorRedirect: true,
    }),
};

export const studentApi = {
  getProfile: () => api.get<Profile>('/api/v1/students/me/'),

  getProfileById: (id: string) => api.get<Profile>(`/api/v1/students/${id}/`),

  getAchievementDetail: (id: string | number) =>
    api.get<PendingDocumentDto>(`/api/v1/achievements/${id}/`, { skipErrorRedirect: true }),

  getAchievementConfig: () => api.get<AchievementConfigResponse>('/api/v1/achievements/config/'),

  uploadAchievement: (formData: FormData) =>
    api.post<MessageDto>('/api/v1/achievements/', formData, {headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000}),

  updateAchievement: (id: number, formData: FormData) =>
    api.patch(`/api/v1/achievements/${id}/`, formData, {headers: { 'Content-Type': 'multipart/form-data' },}),

  deleteAchievement: (id: number) => api.delete(`/api/v1/achievements/${id}/`),

  downloadDocument: (fileId: number) => api.get(`/api/v1/document-files/${fileId}/download/`, {
    responseType: 'blob',
    skipErrorRedirect: true,
  }),

  previewDocument: (fileId: number) => api.get(`/api/v1/document-files/${fileId}/preview/`, {
    responseType: 'blob',
    skipErrorRedirect: true,
    // Конвертация офисных форматов в PDF на сервере может занять время.
    timeout: 30000,
  }),
};

export const universityApi = {
  getStaffProfile: () => api.get<StaffProfileResponseDto>('/api/v1/staff/me/'),

  getRejectionReasons: () => api.get<RejectionReasonDto[]>('/api/v1/rejection-reasons/'),

  getAcademicYears: () => api.get<AcademicYearDto[]>('/api/v1/academic-years/'),

  getFilteredGroups: (params?: FilterParams) =>
    api.get<GroupDto[]>('/api/v1/groups/', { params }),

  getFilteredStudents: (params: FilterStudentsParams) =>
    api.get<Paginated<StudentProfileDto>>('/api/v1/students/', { params }),

  getFilteredDashboardStats: (params: DashboardStatsParams) =>
    api.get<DashboardStatsResponse>('/api/v1/achievements/', { params }),

  reviewDocument: (documentId: number, data: ReviewDocumentRequestDto) =>
    api.post<MessageDto>(`/api/v1/achievements/${documentId}/review/`, data),

  exportRatingToExcel: (params?: ExportExcelParams) =>
    api.get('/api/v1/rating/export/', { params, responseType: 'blob' }),
};

export const userApi = {
  getCategoryAchievements: () => api.get<CategoryDto[]>('/api/v1/categories/'),

  getRatingFilters: () => api.get<RatingFiltersResponseDto>('/api/v1/rating/filters/'),

  getRating: (params: RatingParams) => api.get<Paginated<StudentRatingDto>>('/api/v1/rating/', { params }),
};
