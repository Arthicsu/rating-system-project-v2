/**
 * Серверные DTO приходят из сгенерированных OpenAPI-типов (lib/api.ts) —
 * здесь только реэкспорты под историческими именами + UI-only типы.
 */
import type {
  AcademicYearDto,
  FacultyFilterDto,
  GroupDto,
  PendingDocumentDto,
  RejectionReasonDto,
  StaffProfileResponseDto,
} from '@/lib/api';

export type RejectionReason = RejectionReasonDto;
export type Semester = AcademicYearDto;
export type Faculty = FacultyFilterDto;
export type Group = GroupDto;
export type Document = PendingDocumentDto;
export type StaffProfile = StaffProfileResponseDto;

export type { DashboardStats, DashboardStatsResponse, StudentSimple } from '@/lib/api';

// --- UI-only типы ------------------------------------------------------------

export interface Category {
  code: string;
  label: string;
}

export interface FacultySimple {
  id: string;
  short_name: string;
}

export interface Department {
  id: number;
  short_name: string;
  name: string;
  faculty_id: number;
}

export interface FilterStudentsParams {
  group_id: string;
  page: number;
  page_size: number;
  search?: string;
  faculty_id?: string;
  course?: string;
  academic_year?: string;
}

export interface DashboardStatsParams {
  group_id: string;
  academic_year: string;
  page: number;
  page_size: number;
  search?: string;
  faculty_id?: string;
  course?: string;
  list_type?: 'pending' | 'reviewed';
}

export type ReviewDocumentData =
  | { action: 'approve' }
  | { action: 'reject'; reasons: string[] };

export interface ModalState {
  type: string | null;
  targetId: number | null;
  targetScore: number;
  targetStudentId: number | null;
}

export {}
