import type { FacultySimple } from './StaffInterfaces';

export interface PaginationProps {
  page: number;
  totalCount: number;
  pageSize: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
}

export interface FilterOptions {
  faculties: FacultySimple[];
  courses: Array<number>;
  groups: Array<{ id: string; name: string; course: number; faculty_id: string; academic_year: string }>;
}

export interface Tab {
  id: string;
  label: string;
}

export interface CategoryAchievement {
  code: string;
  label: string;
}

export interface Category {
  code: string;
  label: string;
}

export interface RatingParams {
  faculty_id?: string;
  course?: string;
  group_id?: string;
  category: string;
  page: number;
  page_size: number;
}

export interface FilterParams {
  course?: string;
  faculty_id?: string;
}

export interface ExportExcelParams {
  faculty_id?: string;
  course?: string;
  group_id?: string;
  category?: string;
  page?: number;
}