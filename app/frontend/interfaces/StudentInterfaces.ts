export default interface Student {
  user_id: number;
  full_name: string;
  total_score: number;
  faculty: string;
  course: number;
  group: string;
  [key: string]: unknown;
}