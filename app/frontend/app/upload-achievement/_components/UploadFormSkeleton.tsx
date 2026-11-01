import { Bone, BoneLine, SkeletonScreen } from '@/components/Skeleton';

// Высоты полей - строка своего шрифта плюс отступы и рамка, как у настоящих: растут вместе с текстом.
const INPUT = 'h-[calc(1lh+0.875rem)] text-base sm:text-sm';
const SELECT = 'h-[max(2.75rem,calc(1lh+2px))] text-base sm:h-[max(2.5rem,calc(1lh+1rem+2px))] sm:text-sm';
const TEXTAREA = 'h-[calc(2lh+2.25rem)] text-base sm:text-sm';
const DATE = 'h-[max(2.75rem,calc(1lh+0.875rem))] text-base sm:h-[calc(1lh+0.875rem)] sm:text-sm';
const DROP_ZONE = 'min-h-[140px] h-[calc(1.5rem+4lh+2.75rem)] rounded-xl text-sm low-vision:max-sm:h-[calc(1.5rem+7lh+2.75rem)]';

/** Подпись и поле; wraps - подпись, которую крупный текст версии для слабовидящих переносит на телефоне. */
function Field({ label, input, wraps = false }: { label: string; input: string; wraps?: boolean }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs">
        <BoneLine className={label} />
        {wraps && <BoneLine className="hidden w-24 low-vision:max-sm:block" />}
      </div>
      <Bone className={`w-full rounded-lg ${input}`} />
    </div>
  );
}

/**
 * Скелетон формы загрузки достижения - те же поля и карточка, что у формы до выбора категории.
 * withHeader - со строкой заголовка и баллов (пока грузится сессия).
 */
export default function UploadFormSkeleton({ withHeader = false }: { withHeader?: boolean }) {
  return (
    <SkeletonScreen>
      {withHeader && (
        <div className="mb-5 flex items-start justify-between gap-4 sm:items-stretch sm:gap-6">
          <div className="min-w-0 flex-1">
            <div className="text-xl sm:text-2xl md:text-3xl">
              <BoneLine className="w-full max-w-2xl" />
              <BoneLine className="w-1/2 md:hidden" />
            </div>
            <div className="mt-2 text-sm">
              <BoneLine className="w-full max-w-xl" />
              <BoneLine className="w-4/5 sm:hidden" />
              <BoneLine className="hidden w-3/5 low-vision:block" />
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2 sm:px-5">
            <BoneLine className="w-12 text-2xs" />
            <BoneLine className="w-8 text-2xl sm:text-3xl" />
          </div>
        </div>
      )}
      <div className="grid gap-6 rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_16px_50px_rgba(15,23,42,0.16)] sm:grid-cols-[minmax(0,1.4fr),minmax(0,1fr)] sm:p-5">
        <div className="space-y-4">
          <Field label="w-40" input={INPUT} />
          <Field label="w-36" input={SELECT} />
          <Field label="w-40" input={SELECT} wraps />
          <Field label="w-44" input={TEXTAREA} wraps />
          <Field label="w-52 max-w-full" input={DATE} wraps />
          <Field label="w-36" input={DROP_ZONE} />
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-end">
          <Bone className="h-[calc(1lh+1.25rem)] w-32 rounded-full text-sm" />
        </div>
      </div>
    </SkeletonScreen>
  );
}
