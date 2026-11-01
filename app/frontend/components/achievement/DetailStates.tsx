import type { AxiosError } from 'axios';
import type { useRouter } from 'next/navigation';
import PageContainer from '@/components/layout/PageContainer';
import { Bone, BoneLine, SkeletonScreen } from '@/components/Skeleton';

/** Назад по истории, а если страницу открыли в новой вкладке — на `fallback`. */
export function goBack(router: ReturnType<typeof useRouter>, fallback: string) {
  if (window.history.length > 1) router.back();
  else router.push(fallback);
}

export type DetailLoadState = 'loading' | 'ready' | 'forbidden' | 'notfound' | 'error';

/** Состояние загрузки карточки заявки: 403 и 404 различаются для текста ошибки. */
export function detailLoadState(isPending: boolean, error: unknown): DetailLoadState {
  if (isPending) return 'loading';
  if (!error) return 'ready';
  const status = (error as AxiosError).response?.status;
  return status === 403 ? 'forbidden' : status === 404 ? 'notfound' : 'error';
}

/**
 * Скелетон страницы заявки - как у загруженной: «Назад», шапка, данные и файлы слева, просмотр справа.
 * У студента в шапке кнопки правки и удаления, у сотрудника под шапкой - панель решения.
 */
export function DetailSkeleton({ staff = false }: { staff?: boolean }) {
  return (
    <SkeletonScreen>
      <PageContainer>
        <Bone className="mb-1 h-11 w-28 rounded-lg" />
        <div className="mt-5 grid gap-6 lg:grid-cols-5">
          <div className="min-w-0 space-y-5 lg:col-span-2">
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <BoneLine className="w-3/4 text-lg sm:text-xl md:text-2xl" />
                  {staff && <BoneLine className="mt-1 w-2/3 text-sm" />}
                  <div className="mt-2 flex flex-wrap gap-2 text-sm">
                    <Bone className="h-[calc(1lh+0.5rem)] w-32 rounded-full" />
                    <Bone className="h-[calc(1lh+0.5rem)] w-12 rounded-full" />
                    <Bone className="h-[calc(1lh+0.5rem)] w-40 rounded-full" />
                  </div>
                </div>
                {!staff && (
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <Bone className="h-11 w-36 rounded-lg" />
                    <Bone className="h-11 w-28 rounded-lg" />
                  </div>
                )}
              </div>
            </div>
            {staff && (
              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
                <BoneLine className="w-20 text-xs" />
                <div className="mt-3 flex gap-2">
                  <Bone className="h-11 flex-1 rounded-lg" />
                  <Bone className="h-11 flex-1 rounded-lg" />
                </div>
                <div className="mt-2 flex min-h-11 items-center">
                  <BoneLine className="w-32 text-sm" />
                </div>
              </div>
            )}
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
              <BoneLine className="mb-2 w-24 text-xs" />
              <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                {Array.from({ length: 8 }, (_, i) => (
                  <div key={i}>
                    <BoneLine className="w-20 text-xs" />
                    <BoneLine className="w-32 text-sm" />
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
              <BoneLine className="mb-2 w-16 text-xs" />
              <div className="flex min-h-11 items-center">
                <BoneLine className="w-48 text-sm" />
              </div>
            </div>
          </div>
          <div className="min-w-0 lg:col-span-3">
            <div className="flex h-[80vh] min-h-[500px] flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm lg:h-[calc(120vh-10rem)]">
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2">
                <BoneLine className="w-40 text-sm" />
                <Bone className="h-11 w-11 rounded-lg sm:w-36" />
              </div>
              <div className="flex min-h-0 flex-1 p-6">
                <Bone className="mx-auto h-full w-full max-w-md rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      </PageContainer>
    </SkeletonScreen>
  );
}

const MESSAGES: Record<Exclude<DetailLoadState, 'loading' | 'ready'>, string> = {
  forbidden: 'У вас нет доступа к этой заявке.',
  notfound: 'Заявка не найдена.',
  error: 'Не удалось загрузить информацию о заявке.',
};

/** Ошибка загрузки заявки с кнопкой «Назад». */
export function DetailError({ state, onBack }: { state: DetailLoadState; onBack: () => void }) {
  const message = MESSAGES[state as keyof typeof MESSAGES] ?? MESSAGES.error;
  return (
    <PageContainer>
      <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center shadow-sm">
        <i className="fa-solid fa-circle-exclamation mb-3 text-3xl text-slate-300" aria-hidden="true" />
        <p className="text-sm text-slate-600">{message}</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 min-h-11 cursor-pointer rounded-lg bg-sky-700 px-4 text-sm font-medium text-white transition hover:bg-sky-800"
        >
          Назад
        </button>
      </div>
    </PageContainer>
  );
}

/** Кнопка «Назад» над страницей заявки. */
export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-1 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
    >
      <i className="fa-solid fa-arrow-left" aria-hidden="true" />
      Назад
    </button>
  );
}
