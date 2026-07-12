/**
 * Ограничения файлов достижения — зеркало backend
 * (students/serializers.py: validate_achievement_files).
 * Единый источник для клиентских проверок
 * (upload_achievement, modalEditAchievement, FileDropZone).
 */
export const MAX_FILES = 3;
export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 МБ на файл
export const MAX_TOTAL_SIZE = 20 * 1024 * 1024; // 20 МБ суммарно
export const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.png', '.jpeg', '.jpg', '.webp', '.gif', '.bmp'];
