interface Achievement {
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

export default interface AchievementItemProps {
  doc?: Achievement;
  loading?: boolean;
}