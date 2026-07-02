export interface Profile {
  id?: number;
  full_name: string;
  record_book: string | null;
  faculty: string;
  course: number;
  group: string;
  total_score: number;
  type: string;
  is_own_profile: boolean;
  is_staff?: boolean;
  radar_stats: {
    labels: string[];
    data: number[];
  };
  documents: Array<{
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
  }>;
  semester_history?: SemesterScoreHistory[];
}

export interface SemesterScoreHistory {
  semester_id: number;
  semester_label: string;
  is_current: boolean;
  start_date: string;
  end_date: string;
  total_score: number;
  academic_score: number;
  research_score: number;
  sport_score: number;
  social_score: number;
  cultural_score: number;
}

export interface StudentProfileProps {
  profile: Profile;
  isOwner: boolean;
  loading?: boolean;
  onRefresh?: () => void;
}