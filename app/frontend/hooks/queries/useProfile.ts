import { useQuery } from '@tanstack/react-query';

import { studentApi } from '@/lib/apiRequests';
import { qk } from '@/lib/queryKeys';

export function useMyProfile() {
  return useQuery({
    queryKey: qk.profile(),
    queryFn: () => studentApi.getProfile().then((r) => r.data),
  });
}

export function useProfileById(id: string) {
  return useQuery({
    queryKey: qk.profile(id),
    queryFn: () => studentApi.getProfileById(id).then((r) => r.data),
    enabled: !!id,
  });
}
