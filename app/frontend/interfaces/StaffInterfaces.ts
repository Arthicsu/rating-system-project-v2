export interface RejectionReason {
  id: number;
  text: string;
}

export interface Semester {
  id: number;
  label: string;
  is_current: boolean;
}

export interface Category {
  code: string;
  label: string;
}

export interface Faculty {
  id: number;
  short_name: string;
  name: string;
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

export interface Group {
  id: string;
  name: string;
  academic_year: string;
}

export interface Document {
  id: number;
  student_id: number;
  student_name: string;
  record_book: string;
  course: number;
  faculty: string;
  group: string;
  achievement: string;
  category_display: string;
  doc_type_display: string;
  sub_type_display: string;
  level_display: string | null;
  result_display: string | null;
  date_received: string;
  uploaded_at: string;
  score: number;
  files: Array<{ id: number; original_file_name: string }>;
  rejection_reason: string | null;
  status_display?: string;
}

export interface StaffProfile {
  id: number;
  email: string;
  department: {
    id: number;
    name: string;
    short_name: string;
  } | null;
  faculty: {
    id: number;
    name: string;
    short_name: string;
  } | null;
  phone: string;
  roles: string[];
  is_own_profile: boolean;
  is_staff: boolean;
  type: string;
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

export interface DashboardStats {
  total_students: number;
  avg_score: number;
  max_score: number;
  min_score: number;
  /** Суммы баллов по каждой категории, ключ — код категории (academic, sport, ...). */
  categories: Record<string, number>;
}

export interface DashboardStatsResponse {
  count: number;
  stats: DashboardStats;
  results: Document[];
  top5: StudentSimple[];
}

export interface StudentSimple {
  id: number;
  full_name: string;
  total_score: number;
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