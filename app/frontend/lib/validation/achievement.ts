/**
 * Ограничения файлов достижения — зеркало backend
 * (students/serializers.py: validate_achievement_files).
 * Единый источник для клиентских проверок
 * (upload_achievement, modalEditAchievement, FileDropZone).
 */
import { z } from 'zod';

import type { SelectOption } from '@/interfaces/AchievementInterfaces';

export const MAX_FILES = 3;
export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 МБ на файл
export const MAX_TOTAL_SIZE = 20 * 1024 * 1024; // 20 МБ суммарно
export const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.png', '.jpeg', '.jpg', '.webp', '.gif', '.bmp'];

/**
 * Схемы форм достижения (react-hook-form + zodResolver).
 *
 * Размер/количество/формат файлов здесь не перепроверяются: их применяет
 * FileDropZone на входе, невалидный файл в состояние формы не попадает.
 * Схема проверяет то, что дропзона проверить не может: обязательные поля
 * и сам факт наличия файлов.
 *
 * Обязательность level/result зависит от выбранного вида деятельности
 * (needsLevel/needsResult), поэтому проверяется в superRefine: subType
 * лежит в самих значениях формы, отдельная фабрика схем не нужна.
 */
export const uploadAchievementSchema = z
  .object({
    category: z.string().nullable().refine((v): v is string => !!v, 'Выберите категорию'),
    subType: z.custom<SelectOption | null>().refine((v) => v != null, 'Выберите вид деятельности'),
    level: z.custom<SelectOption | null>(),
    result: z.custom<SelectOption | null>(),
    docType: z.custom<SelectOption | null>().refine((v) => v != null, 'Выберите тип документа'),
    achievement: z.string().trim().min(1, 'Укажите название достижения').max(1000),
    dateReceived: z.string().min(1, 'Укажите дату получения'),
    files: z.array(z.instanceof(File)).min(1, 'Прикрепите файл(-ы) подтверждения достижения'),
  })
  .superRefine((data, ctx) => {
    if (data.subType?.needsLevel && !data.level) {
      ctx.addIssue({ code: 'custom', path: ['level'], message: 'Пожалуйста, выберите уровень мероприятия.' });
    }
    if (data.subType?.needsResult && !data.result) {
      ctx.addIssue({ code: 'custom', path: ['result'], message: 'Пожалуйста, выберите результат / место.' });
    }
  });

// input - состояние формы (селекты nullable), output - провалидированные
// значения после refine (обязательные селекты уже не null).
export type UploadAchievementValues = z.input<typeof uploadAchievementSchema>;
export type UploadAchievementSubmit = z.output<typeof uploadAchievementSchema>;

export const editAchievementSchema = z.object({
  achievement: z.string().trim().min(1, 'Укажите название достижения').max(1000),
  dateReceived: z.string().min(1, 'Укажите дату получения'),
  // Пустой список = "файлы не заменять": PATCH без files сохраняет старые.
  files: z.array(z.instanceof(File)),
});

export type EditAchievementValues = z.infer<typeof editAchievementSchema>;
