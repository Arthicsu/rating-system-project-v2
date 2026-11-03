import Card from '@/components/Card';
import { Bone, BoneLine, BUTTON_BONE, SkeletonScreen } from '@/components/Skeleton';

// Высоты полей - строка своего шрифта плюс отступы и рамка, как у настоящих: растут вместе с текстом.
// Номер зачётки - text-sm и на телефоне, остальные поля на телефоне крупнее (text-base).
const RECORD = 'h-[calc(1lh+0.875rem)] text-sm';
const SELECT = 'h-[max(2.75rem,calc(1lh+2px))] text-base sm:h-[max(2.5rem,calc(1lh+1rem+2px))] sm:text-sm';
const TEXTAREA = 'h-[calc(2lh+2.25rem)] text-base sm:text-sm';
const DATE = 'h-[max(2.75rem,calc(1lh+0.875rem))] text-base sm:h-[calc(1lh+0.875rem)] sm:text-sm';
// Зона файлов: рамка, отступы и значок (6rem) плюс строки подсказки - на телефоне их четыре, шире - три.
const DROP_ZONE = 'min-h-[140px] h-[calc(6rem+4lh)] rounded-xl text-xs sm:h-[calc(6rem+3lh)] low-vision:max-sm:h-[calc(6rem+7lh)]';

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
        <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="min-w-48 flex-1">
            <div className="text-xl sm:text-2xl">
              <BoneLine className="w-full max-w-xl" />
              <BoneLine className="w-1/2 md:hidden" />
            </div>
            <div className="mt-1 text-sm">
              <BoneLine className="w-full max-w-2xl" />
              <BoneLine className="w-4/5 lg:hidden" />
              <BoneLine className="w-3/5 sm:hidden" />
              <BoneLine className="hidden w-2/5 low-vision:block" />
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2 sm:min-w-24 sm:px-5">
            <BoneLine className="w-12 text-2xs" />
            <BoneLine className="w-8 text-2xl leading-tight sm:text-3xl" />
          </div>
        </div>
      )}
      <Card className="grid gap-x-6 gap-y-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Field label="w-40" input={RECORD} />
          <Field label="w-36" input={SELECT} />
          <Field label="w-40" input={SELECT} wraps />
          <Field label="w-44" input={TEXTAREA} wraps />
          <Field label="w-52 max-w-full" input={DATE} wraps />
        </div>
        <Field label="w-36" input={DROP_ZONE} />
        <div className="flex justify-end border-t border-slate-100 pt-4 lg:col-span-2">
          <Bone className={`w-full sm:w-24 ${BUTTON_BONE.md}`} />
        </div>
      </Card>
    </SkeletonScreen>
  );
}
