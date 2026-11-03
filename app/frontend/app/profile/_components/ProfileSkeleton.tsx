import Card, { CARD_TITLE, PANEL } from '@/components/Card';
import PageContainer from '@/components/layout/PageContainer';
import { Bone, BoneLine, BUTTON_BONE, SkeletonScreen } from '@/components/Skeleton';
import { ITEM_LAYOUT, ITEM_SIDE } from './AchievementItem';

// Таблетки категорий разной длины: на телефоне переносятся на строки, как настоящие.
const PILL_WIDTHS = ['w-36', 'w-24', 'w-52', 'w-44', 'w-20', 'w-32'];

// Высоты таблеток и кнопок - строка своего шрифта плюс отступы, как у настоящих: растут вместе с текстом.
// Строки low-vision:block - переносы, которые появляются у крупного текста версии для слабовидящих.

function ItemSkeleton({ isOwner }: { isOwner: boolean }) {
  return (
    <Card padding="sm" className={ITEM_LAYOUT}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Bone className="mt-1 size-8 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-1">
          <BoneLine className="w-3/4 text-sm" />
          <div className="flex flex-wrap gap-1.5 text-2xs">
            <Bone className="h-[calc(1lh+0.25rem)] w-20 rounded-full" />
            <Bone className="h-[calc(1lh+0.25rem)] w-32 rounded-full" />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-2xs">
            <BoneLine className="w-36" />
            <BoneLine className="w-32" />
            <span className="flex items-center gap-1.5">
              <span className="mr-1 flex min-h-11 items-center sm:min-h-6">
                <BoneLine className="w-16" />
              </span>
              {isOwner && (
                <>
                  <Bone className={BUTTON_BONE.icon} />
                  <Bone className={BUTTON_BONE.icon} />
                </>
              )}
            </span>
          </div>
        </div>
      </div>
      <div className={ITEM_SIDE}>
        <div className="flex flex-wrap items-center gap-1.5">
          <Bone className="h-[calc(1lh+0.5rem)] w-28 rounded-full text-xs" />
          <Bone className="h-[calc(1lh+0.5rem+2px)] w-12 rounded-full text-sm" />
        </div>
      </div>
    </Card>
  );
}

/**
 * Скелетон профиля студента - те же блоки и контейнеры, что у загруженного: шапка с баллом,
 * диаграмма и распределение по видам, история по семестрам, лента достижений.
 */
export default function ProfileSkeleton({ isOwner }: { isOwner: boolean }) {
  return (
    <SkeletonScreen>
      <PageContainer className="space-y-4 sm:space-y-5">
        <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <div className="text-xl sm:text-2xl">
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
        </Card>

        <Card>
          <BoneLine className={`mb-3 w-60 max-w-full ${CARD_TITLE}`} />
          <div className="flex flex-col gap-5 lg:grid lg:grid-cols-3">
            <div className="flex h-64 items-center justify-center lg:col-span-2">
              <Bone className="aspect-square h-3/4 rounded-full" />
            </div>
            <div className={`flex flex-col gap-2 ${PANEL}`}>
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="flex items-center justify-between gap-2 rounded-xl bg-sky-50 px-3 py-1.5 text-xs sm:text-sm">
                  <div className="min-w-0 flex-1">
                    <BoneLine className="w-36 max-w-full" />
                    <BoneLine className="hidden w-24 low-vision:block" />
                  </div>
                  <Bone className="h-[calc(1lh+0.25rem)] w-8 shrink-0 rounded-full text-xs" />
                </div>
              ))}
              {isOwner && <Bone className={`mt-2 w-full ${BUTTON_BONE.md}`} />}
            </div>
          </div>
        </Card>

        <Card>
          <BoneLine className={`mb-3 w-56 max-w-full ${CARD_TITLE}`} />
          {[0, 1].map((i) => (
            <div key={i} className="px-2 py-1.5 text-xs sm:text-sm">
              <BoneLine className="w-full" />
              <BoneLine className="hidden w-full max-sm:block low-vision:block" />
            </div>
          ))}
        </Card>

        <Card>
          <BoneLine className={`mb-3 w-28 ${CARD_TITLE}`} />
          <div className="border-b border-slate-200 pb-1.5 text-xs sm:text-sm">
            <Bone className="h-[calc(1lh+1rem)] w-[26rem] max-w-full rounded-md max-sm:min-h-11" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs sm:text-sm">
            {PILL_WIDTHS.map((width) => (
              <Bone key={width} className={`h-[max(2.75rem,1lh)] rounded-full sm:h-[max(2.25rem,1lh)] ${width}`} />
            ))}
          </div>
          <div className="mt-4 space-y-3">
            <ItemSkeleton isOwner={isOwner} />
            <ItemSkeleton isOwner={isOwner} />
            <ItemSkeleton isOwner={isOwner} />
          </div>
        </Card>
      </PageContainer>
    </SkeletonScreen>
  );
}
