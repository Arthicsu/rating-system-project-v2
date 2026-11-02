'use client';

import { useEffect } from 'react';

/**
 * Сервер отдаёт последнюю существующую страницу вместо пропавшей (одобрили последнюю
 * карточку на последней странице, старая ссылка) — переходим на неё, без экрана 404.
 */
export function useServerPage(
  query: { data?: { page: number }; isPlaceholderData: boolean; isFetching: boolean },
  page: number,
  setPage: (page: number) => void,
) {
  // Пока показаны прежние данные или идёт перезапрос, номер не в счёт: в кэше страницы мог
  // остаться старый ответ (страница 3 отдавалась как 2), и он отменил бы клик по «3».
  const served = query.isPlaceholderData || query.isFetching ? undefined : query.data?.page;
  useEffect(() => {
    if (served && served !== page) setPage(served);
  }, [served, page, setPage]);
}
