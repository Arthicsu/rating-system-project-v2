import { useQuery } from '@tanstack/react-query';

import { universityApi } from '@/lib/apiRequests';
import { qk } from '@/lib/queryKeys';
import type { FilterParams } from '@/interfaces/RatingInterfaces';

/** Группы, доступные сотруднику (scope backend), с фильтрами по курсу/факультету. */
export function useGroups(params: FilterParams) {
  return useQuery({
    queryKey: qk.groups(params),
    queryFn: () => universityApi.getFilteredGroups(params).then((r) => r.data),
  });
}
