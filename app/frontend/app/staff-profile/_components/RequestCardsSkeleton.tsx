import { Bone, BoneLine, SkeletonScreen } from '@/components/Skeleton';

/** Скелетон карточек-заявок на время первой загрузки списка: те же сетка и карточка, что у RequestCard. */
export default function RequestCardsSkeleton() {
  return (
    <SkeletonScreen>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 12 }, (_, i) => (
          <div
            key={i}
            className="flex flex-col rounded-xl border border-slate-200 bg-white p-3 shadow-[0_4px_12px_rgba(15,23,42,0.08)] sm:p-4"
          >
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
            <BoneLine className="mt-1 w-2/5 text-xs" />
            <div className="mt-auto flex min-h-11 items-center justify-between pt-2">
              <BoneLine className="w-20 text-xs" />
              <BoneLine className="w-16 text-xs" />
            </div>
            <div className="mt-3 flex gap-2">
              <Bone className="h-11 flex-1 rounded-lg" />
              <Bone className="h-11 flex-1 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonScreen>
  );
}
