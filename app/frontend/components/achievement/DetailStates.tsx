import type { AxiosError } from 'axios';
import type { useRouter } from 'next/navigation';
import Button from '@/components/Button';
import Card from '@/components/Card';
import PageContainer from '@/components/layout/PageContainer';
import { Bone, BoneLine, BUTTON_BONE, SkeletonScreen } from '@/components/Skeleton';

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
 * У студента под метками шапки кнопки правки и удаления, у сотрудника под шапкой - панель решения.
 */
export function DetailSkeleton({ staff = false }: { staff?: boolean }) {
  return (
    <SkeletonScreen>
      <PageContainer>
        <Bone className={`mb-1 w-28 ${BUTTON_BONE.md}`} />
        <div className="mt-5 grid gap-6 lg:grid-cols-5">
          <div className="min-w-0 space-y-5 lg:col-span-2">
            <Card>
              <BoneLine className="w-3/4 text-xl sm:text-2xl" />
              {staff && <BoneLine className="mt-1 w-2/3 text-sm" />}
              <div className="mt-2 flex flex-wrap gap-2 text-sm">
                <Bone className="h-[calc(1lh+0.5rem)] w-32 rounded-full" />
                <Bone className="h-[calc(1lh+0.5rem)] w-12 rounded-full" />
                <Bone className="h-[calc(1lh+0.5rem)] w-40 rounded-full" />
              </div>
              {!staff && (
                <div className="mt-3 flex gap-2">
                  <Bone className={`w-36 ${BUTTON_BONE.sm}`} />
                  <Bone className={`w-28 ${BUTTON_BONE.sm}`} />
                </div>
              )}
            </Card>
            {staff && (
              <Card>
                <BoneLine className="w-20 text-base" />
                <div className="mt-2 flex gap-2">
                  <Bone className={`flex-1 ${BUTTON_BONE.md}`} />
                  <Bone className={`flex-1 ${BUTTON_BONE.md}`} />
                </div>
                <div className="mt-2 flex min-h-11 items-center">
                  <BoneLine className="w-32 text-sm" />
                </div>
              </Card>
            )}
            <Card>
              <BoneLine className="mb-2 w-28 text-base" />
              <BoneLine className="w-3/4 text-sm leading-relaxed sm:text-base" />
              <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                {Array.from({ length: 8 }, (_, i) => (
                  <div key={i}>
                    <BoneLine className="w-20 text-xs" />
                    <BoneLine className="w-32 text-sm" />
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <BoneLine className="mb-2 w-16 text-base" />
              <div className="flex min-h-11 items-center">
                <BoneLine className="w-48 text-sm" />
              </div>
            </Card>
          </div>
          <div className="min-w-0 lg:col-span-3">
            <Card padding="none" className="flex h-[80vh] min-h-[500px] flex-col overflow-hidden lg:h-[calc(120vh-10rem)]">
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2">
                <BoneLine className="w-40 text-sm" />
                <Bone className={`w-11 sm:w-36 ${BUTTON_BONE.sm}`} />
              </div>
              <div className="flex min-h-0 flex-1 p-6">
                <Bone className="mx-auto h-full w-full max-w-md rounded-lg" />
              </div>
            </Card>
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
      <Card padding="lg" className="text-center">
        <i className="fa-solid fa-circle-exclamation mb-3 text-3xl text-slate-300" aria-hidden="true" />
        <p className="text-sm text-slate-600">{message}</p>
        <Button className="mt-4" onClick={onBack}>
          Назад
        </Button>
      </Card>
    </PageContainer>
  );
}

/** Кнопка «Назад» над страницей заявки. */
export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    // flex-обёртка: кнопка не стоит в строке текста — высота ровно как у кости скелетона.
    <div className="mb-1 flex">
      <Button variant="secondary" onClick={onClick}>
        <i className="fa-solid fa-arrow-left" aria-hidden="true" />
        Назад
      </Button>
    </div>
  );
}
