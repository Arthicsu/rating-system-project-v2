import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { universityApi } from '@/lib/apiRequests';
import { qk } from '@/lib/queryKeys';
import type { FilterStudentsParams } from '@/interfaces/StaffInterfaces';

/** Список студентов сотрудника (вкладка «Группа» staff-профиля). */
export function useStudents(params: FilterStudentsParams, enabled = true) {
  return useQuery({
    queryKey: qk.students(params),
    queryFn: () => universityApi.getFilteredStudents(params).then((r) => r.data),
    placeholderData: keepPreviousData,
    enabled,
  });
}
