/**
 * Номера кнопок пагинации: до 7 страниц - все, дальше всегда 7 мест (первая, последняя,
 * текущая с соседями и «…»), чтобы ряд не менял ширину при листании.
 */
export function pageWindow(page: number, pages: number): (number | '…')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  if (page <= 4) return [1, 2, 3, 4, 5, '…', pages];
  if (page >= pages - 3) return [1, '…', pages - 4, pages - 3, pages - 2, pages - 1, pages];
  return [1, '…', page - 1, page, page + 1, '…', pages];
}
