export interface Achievement {
  id: number;
  achievement: string;
  status: number;
  status_display: string;
  category_display: string;
  sub_type_display: string;
  level_display: string | null;
  result_display: string | null;
  date_received: string;
  uploaded_at: string;
  score: number;
  rejection_reason: string | null;
  files: Array<{ id: number; original_file_name: string }>;
}

export interface AchievementItemProps {
  doc?: Achievement;
  loading?: boolean;
}

export interface SelectOption {
  code: string;
  label: string;
  needsLevel?: boolean;
  needsResult?: boolean;
  allowedResults?: string[];
}

export interface DataStructureCategory {
  label: string;
  sub_types: SelectOption[];
}

export interface DataStructure {
  [key: string]: DataStructureCategory;
}

export interface AchievementConfigResponse {
  structure: DataStructure;
  levels: SelectOption[];
  results: SelectOption[];
  doc_types: SelectOption[];
}

export interface AchievementUploadResponse {
  message: string;
}