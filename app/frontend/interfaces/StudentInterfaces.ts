/**
 * Строка таблицы студентов (rating / staff-список). Общий знаменатель
 * StudentRating и StudentProfile из OpenAPI-типов; индекс-сигнатура — для
 * динамического доступа к баллам по коду категории (`${code}_score`).
 */
export default interface Student {
  id: number;
  user_id: number | null;
  full_name: string;
  short_name: string;
  record_book?: string | null;
  total_score: number;
  faculty: string;
  course: number;
  group: string;
  [key: string]: unknown;
}
