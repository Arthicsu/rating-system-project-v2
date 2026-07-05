
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

export interface ExportExcelButtonProps {
  filters: {
    faculty_id?: string;
    course?: string;
    group_id?: string;
  };
  category?: string;
  page?: number;
}
