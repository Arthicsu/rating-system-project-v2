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

export interface Group {
  id: number;
  name: string;
  academic_year: string;
}

export interface Document {
  id: number;
  student_id: number;
  student_name: string;
  record_book: string;
  achievement: string;
  category_display: string;
  sub_type_display: string;
  level_display: string | null;
  result_display: string | null;
  date_received: string;
  uploaded_at: string;
  score: number;
  files: Array<{ id: number; original_file_name: string }>;
  rejection_reason: string | null;
}

export {}