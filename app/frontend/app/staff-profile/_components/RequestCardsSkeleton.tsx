import Card from '@/components/Card';
import { Bone, BoneLine, BUTTON_BONE, SkeletonScreen } from '@/components/Skeleton';

/** Скелетон карточек-заявок на время первой загрузки списка: те же сетка и карточка, что у RequestCard. */
export default function RequestCardsSkeleton() {
  return (
    <SkeletonScreen>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 12 }, (_, i) => (
          <Card key={i} padding="sm" className="flex flex-col">
            <BoneLine className="w-2/3 text-sm" />
            <BoneLine className="w-1/2 text-xs" />
            <div className="mt-2 flex gap-1 text-xs">
              <Bone className="h-[calc(1lh+0.25rem)] w-24 rounded-full" />
              <Bone className="h-[calc(1lh+0.25rem)] w-10 rounded-full" />
            </div>
            <div className="mt-2 text-sm">
              <BoneLine className="w-full" />
              <BoneLine className="w-4/5" />
            </div>
            <div className="mt-auto flex items-center justify-between gap-x-3 pt-1.5">
              <BoneLine className="w-2/5 text-xs" />
              <span className="flex min-h-11 items-center sm:min-h-6">
                <BoneLine className="w-16 text-xs" />
              </span>
            </div>
            <div className="mt-2 flex gap-2">
              <Bone className={`${BUTTON_BONE.sm} flex-1`} />
              <Bone className={`${BUTTON_BONE.sm} flex-1`} />
            </div>
          </Card>
        ))}
      </div>
    </SkeletonScreen>
  );
}
