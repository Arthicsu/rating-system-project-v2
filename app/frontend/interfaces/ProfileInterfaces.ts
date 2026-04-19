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
  isStaff?: boolean;
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
}

export interface StudentProfileProps {
  profile: Profile;
  isOwner: boolean;
  loading?: boolean;
}