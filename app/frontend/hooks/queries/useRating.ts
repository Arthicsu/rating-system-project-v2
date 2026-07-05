import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { userApi } from '@/lib/apiRequests';
import { qk } from '@/lib/queryKeys';
import type { RatingParams } from '@/interfaces/RatingInterfaces';

export function useRating(params: RatingParams) {
  return useQuery({
    queryKey: qk.rating(params),
    queryFn: () => userApi.getRating(params).then((r) => r.data),
    // При смене страницы/фильтра показываем прежние строки (существующий UX opacity-40).
    placeholderData: keepPreviousData,
  });
}
