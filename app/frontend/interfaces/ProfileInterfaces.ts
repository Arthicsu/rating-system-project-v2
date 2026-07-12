/**
 * Профиль студента: серверный DTO — из сгенерированных OpenAPI-типов
 * (lib/api.ts, composed Profile = StudentProfile + radar_stats/is_own_profile).
 */
import type { Profile, SemesterScoreDto } from '@/lib/api';

export type { Profile } from '@/lib/api';

export type SemesterScoreHistory = SemesterScoreDto;

export interface StudentProfileProps {
  // null на время загрузки: компонент сам рисует скелетон (ветка loading)
  // и заглушку "не найден" (ветка !profile).
  profile: Profile | null;
  isOwner: boolean;
  loading?: boolean;
  onRefresh?: () => void;
}
