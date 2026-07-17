import AchievementItem from './AchievementItem';
import type { Achievement } from '@/interfaces/AchievementInterfaces';

type SectionVariant = 'approved' | 'pending' | 'rejected';

// Секции достижений отличаются только цветами, иконкой и заголовком,
// поэтому оформление собрано в одну мапу по варианту.
const SECTION_CONFIG: Record<SectionVariant, {
  container: string;
  badge: string;
  icon: string;
  title: string;
  titleClass: string;
}> = {
  approved: {
    container: 'rounded-2xl border border-sky-100 bg-sky-100 p-4 shadow-sm sm:p-5',
    badge: 'bg-emerald-600',
    icon: 'fa-solid fa-check',
    title: 'Подтвержденные достижения',
    titleClass: 'text-sky-700',
  },
  pending: {
    container: 'rounded-2xl border border-amber-100 bg-amber-50 p-4 shadow-sm sm:p-5',
    badge: 'bg-amber-500',
    icon: 'fa-regular fa-clock',
    title: 'Ожидающие подтверждения',
    titleClass: 'text-amber-900',
  },
  rejected: {
    container: 'rounded-2xl border border-rose-100 bg-rose-200 p-4 shadow-sm sm:p-5',
    badge: 'bg-rose-500',
    icon: 'fa-regular fa-circle-xmark',
    title: 'Отклоненные',
    titleClass: 'text-rose-900',
  },
};

interface AchievementSectionProps {
  variant: SectionVariant;
  docs: Achievement[];
  onEdit?: (doc: Achievement) => void;
  onDelete?: (doc: Achievement) => void;
}

export default function AchievementSection({ variant, docs, onEdit, onDelete }: AchievementSectionProps) {
  if (docs.length === 0) return null;

  const cfg = SECTION_CONFIG[variant];
  return (
    <div className={cfg.container}>
      <div className="mb-3 flex items-center gap-2">
        <span className={`flex h-7 w-7 items-center justify-center rounded-full ${cfg.badge} text-white`}>
          <i className={cfg.icon} />
        </span>
        <h2 className={`text-sm font-semibold ${cfg.titleClass} sm:text-base`}>
          {cfg.title}
        </h2>
      </div>
      <div className="space-y-3">
        {docs.map((doc: Achievement) => (
          <AchievementItem
            key={doc.id}
            doc={doc}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}
