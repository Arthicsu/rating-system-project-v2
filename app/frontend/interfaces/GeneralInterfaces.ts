
export default interface ApiError {
  response?: {
    // Единый формат ошибок API: {"detail": "..."}.
    // Ошибки валидации сериализаторов приходят пофилдово: {"field": ["msg", ...]}.
    // message остаётся в успешных ответах (login, upload и т.п.).
    data?: {
      detail?: string;
      message?: string;
    } & Record<string, unknown>;
  };
  message?: string;
}

/**
 * Пропсы кнопки выгрузки — параметры текущего среза рейтинга
 * (см. ExportExcelParams): фильтры, категория, семестр, направление.
 * Сентинелы 'all'/'common' кнопка отбрасывает сама.
 */
export type { ExportExcelParams as ExportExcelButtonProps } from '@/interfaces/RatingInterfaces';
