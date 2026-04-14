export interface PaginationProps {
  page: number;
  totalCount: number;
  pageSize: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
}

export interface FilterOptions {
  faculties: Array<{ id: number; short_name: string }>;
  courses: Array<number>;
  groups: Array<{ id: number; name: string; course: number; faculty_id: number; academic_year: string }>;
}

export interface Tab {
  id: string;
  label: string;
}