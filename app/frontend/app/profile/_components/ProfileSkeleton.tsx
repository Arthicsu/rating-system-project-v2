import PageContainer from '@/components/layout/PageContainer';
import { Bone, BoneLine, SkeletonScreen } from '@/components/Skeleton';
import { ITEM_CARD } from './AchievementItem';
import { LIST_CARD, LIST_TITLE } from './AchievementList';

// Таблетки категорий разной длины: на телефоне переносятся на строки, как настоящие.
const PILL_WIDTHS = ['w-36', 'w-24', 'w-52', 'w-44', 'w-20', 'w-32'];

// Высоты таблеток и кнопок - строка своего шрифта плюс отступы, как у настоящих: растут вместе с текстом.
// Строки low-vision:block - переносы, которые появляются у крупного текста версии для слабовидящих.

function ItemSkeleton() {
  return (
    <div className={ITEM_CARD}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Bone className="mt-1 size-8 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-1">
          <BoneLine className="w-3/4 text-sm" />
          <div className="flex flex-wrap gap-1.5 text-2xs">
            <Bone className="h-[calc(1lh+0.25rem)] w-20 rounded-full" />
            <Bone className="h-[calc(1lh+0.25rem)] w-32 rounded-full" />
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-2xs">
            <BoneLine className="w-36" />
            <BoneLine className="w-32" />
          </div>
          <BoneLine className="mt-2 w-16 text-2xs" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 sm:ml-2 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
        <Bone className="h-[calc(1lh+0.5rem)] w-28 rounded-full text-xs" />
        <Bone className="h-[calc(1lh+0.5rem+2px)] w-12 rounded-full text-sm" />
      </div>
    </div>
  );
}

/**
 * Скелетон профиля студента - те же блоки и контейнеры, что у загруженного: шапка с баллом,
 * диаграмма и распределение по видам, история по семестрам, лента достижений.
 */
export default function ProfileSkeleton({ isOwner }: { isOwner: boolean }) {
  return (
    <SkeletonScreen>
      <PageContainer>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_16px_50px_rgba(15,23,42,0.16)] sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
              <div className="text-lg sm:text-xl md:text-2xl">
                <BoneLine className="w-56 max-w-full" />
                <BoneLine className="hidden w-40 low-vision:max-sm:block" />
              </div>
              <BoneLine className="w-44 text-xs sm:text-sm" />
              <div className="text-xs sm:text-sm">
                <BoneLine className="w-60 max-w-full" />
                <BoneLine className="hidden w-32 low-vision:max-sm:block" />
              </div>
            </div>
            <div className="mt-2 flex sm:mt-0 sm:justify-end">
              <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 shadow-sm">
                <BoneLine className="w-20 text-2xs" />
                <BoneLine className="mx-auto w-8 text-2xl sm:text-3xl" />
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-5 lg:grid lg:grid-cols-3">
            <div className="col-span-2 rounded-2xl border border-slate-100 bg-white p-4 sm:p-5">
              <BoneLine className="mb-3 w-52 text-xs" />
              <div className="flex h-64 items-center justify-center sm:h-80">
                <Bone className="aspect-square h-3/4 rounded-full" />
              </div>
            </div>
            <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:p-5">
              <div className="mb-1 text-xs">
                <BoneLine className="w-64 max-w-full" />
                <BoneLine className="hidden w-56 max-w-full low-vision:block" />
                <BoneLine className="hidden w-40 low-vision:block" />
              </div>
              <div className="space-y-2.5">
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 rounded-xl bg-sky-50 px-3 py-2 text-xs sm:text-sm">
                    <div className="min-w-0 flex-1">
                      <BoneLine className="w-36 max-w-full" />
                      <BoneLine className="hidden w-24 low-vision:block" />
                    </div>
                    <Bone className="h-[calc(1lh+0.25rem)] w-8 shrink-0 rounded-full text-xs" />
                  </div>
                ))}
              </div>
              {isOwner && (
                <div className="mt-6 flex justify-center">
                  <Bone className="h-[calc(1lh+1.25rem)] w-60 max-w-full rounded-full text-sm low-vision:h-[calc(2lh+1.25rem)]" />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
          <BoneLine className="mb-3 w-56 max-w-full text-sm sm:text-base" />
          {[0, 1].map((i) => (
            <div key={i} className="px-2 py-2 text-xs sm:text-sm">
              <BoneLine className="w-full" />
              <BoneLine className="hidden w-full max-sm:block low-vision:block" />
            </div>
          ))}
        </div>

        <div className="mt-6">
          <div className={LIST_CARD}>
            <BoneLine className={`${LIST_TITLE} w-28`} />
            <div className="border-b border-slate-200 pb-1.5 text-xs sm:text-sm">
              <Bone className="h-[calc(1lh+1rem)] w-[26rem] max-w-full rounded-md max-sm:min-h-11" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs sm:text-sm">
              {PILL_WIDTHS.map((width) => (
                <Bone key={width} className={`h-[max(2.75rem,1lh)] rounded-full sm:h-[max(2.25rem,1lh)] ${width}`} />
              ))}
            </div>
            <div className="mt-4 space-y-3">
              <ItemSkeleton />
              <ItemSkeleton />
              <ItemSkeleton />
            </div>
          </div>
        </div>
      </PageContainer>
    </SkeletonScreen>
  );
}
