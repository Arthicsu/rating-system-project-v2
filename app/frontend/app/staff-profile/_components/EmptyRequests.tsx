'use client';

interface EmptyRequestsProps {
  /** Включены таблетка состояния или поиск: «Ничего не найдено» и сброс. */
  filtered: boolean;
  /** Текст, когда фильтров нет (например, «Все заявки рассмотрены»). */
  emptyText: string;
  /** Где искали: период и группа из фильтров кабинета. */
  context: string;
  onReset: () => void;
}

/** Пустой список заявок: «всё рассмотрено» отличается от «ничего не нашлось по фильтру». */
export default function EmptyRequests({ filtered, emptyText, context, onReset }: EmptyRequestsProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
      <p className="text-base font-semibold text-slate-900">{filtered ? 'Ничего не найдено' : emptyText}</p>
      <p className="mt-1 text-sm text-slate-600">{context}</p>
      {filtered && (
        <button
          type="button"
          onClick={onReset}
          className="cursor-pointer mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-slate-100 px-5 text-sm font-semibold text-sky-700 transition hover:bg-slate-200"
        >
          Сбросить фильтры
        </button>
      )}
    </div>
  );
}
