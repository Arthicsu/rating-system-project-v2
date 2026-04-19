
export default interface ApiError {
  response?: {
    data?: Record<string, string[]>;
  };
  message?: string;
}

export interface ExportExcelButtonProps {
  filters: {
    faculty_id?: string;
    course?: string;
    group_id?: string;
  };
  category?: string;
  page?: number;
}