export default interface Student {
  id: number;
  user_id: number;
  full_name: string;
  short_name: string;
  record_book: string | null;
  total_score: number;
  faculty: string;
  course: number;
  group: string;
  [key: string]: unknown;
}