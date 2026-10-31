import type { AxiosError } from 'axios';
import type { useRouter } from 'next/navigation';
import PageContainer from '@/components/layout/PageContainer';

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

/** Скелетон страницы заявки на время загрузки. */
export function DetailSkeleton() {
  return (
    <PageContainer>
      <div className="animate-pulse space-y-4">
        <div className="h-11 w-32 rounded-lg bg-slate-200" />
        <div className="h-28 rounded-2xl bg-slate-200" />
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="h-96 rounded-2xl bg-slate-200 lg:col-span-2" />
          <div className="h-96 rounded-2xl bg-slate-200 lg:col-span-3" />
        </div>
      </div>
    </PageContainer>
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
