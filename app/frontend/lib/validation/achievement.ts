/**
 * Ограничения файлов достижения — зеркало backend
 * (students/serializers.py: validate_achievement_files).
 * Единый источник для клиентских проверок
 * (upload-achievement, ModalEditAchievement, FileDropZone).
 */
import { z } from 'zod';

import type { SelectOption } from '@/interfaces/AchievementInterfaces';

export const MAX_FILES = 3;
export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 МБ на файл
export const MAX_TOTAL_SIZE = 20 * 1024 * 1024; // 20 МБ суммарно
export const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.png', '.jpeg', '.jpg', '.webp', '.gif', '.bmp'];

/**
 * Сигнатуры (magic bytes) разрешённых форматов — зеркало FILE_SIGNATURES
 * backend'а. Клиентская проверка даёт мгновенный отказ вместо 400 после
 * полной загрузки файла; авторитетная проверка остаётся на сервере.
 */
export const FILE_SIGNATURES: Record<string, number[][]> = {
  '.pdf': [[0x25, 0x50, 0x44, 0x46, 0x2d]], // %PDF-
  '.doc': [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]], // OLE-контейнер
  '.docx': [[0x50, 0x4b, 0x03, 0x04], [0x50, 0x4b, 0x05, 0x06], [0x50, 0x4b, 0x07, 0x08]], // zip
  '.png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  '.jpg': [[0xff, 0xd8, 0xff]],
  '.jpeg': [[0xff, 0xd8, 0xff]],
  '.gif': [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]], // GIF87a / GIF89a
  '.bmp': [[0x42, 0x4d]], // BM
  '.webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF; формат уточняется байтами 8-11 'WEBP'
};

/** Совпадает ли содержимое файла с сигнатурой его расширения (первые 12 байт). */
export async function matchesFileSignature(file: File): Promise<boolean> {
  const ext = '.' + (file.name.split('.').pop()?.toLowerCase() || '');
  const signatures = FILE_SIGNATURES[ext];
  if (!signatures) return false;

  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const matched = signatures.some(sig => sig.every((byte, i) => header[i] === byte));
  if (ext === '.webp') {
    // RIFF - общий контейнер (wav/avi тоже RIFF), сам формат лежит в байтах 8-11.
    return matched && String.fromCharCode(...header.slice(8, 12)) === 'WEBP';
  }
  return matched;
}

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
