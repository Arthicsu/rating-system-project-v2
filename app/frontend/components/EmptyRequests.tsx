'use client';

import Button from '@/components/Button';
import Card from '@/components/Card';

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
    <Card padding="lg" className="text-center">
      <p className="text-base font-semibold text-slate-900">{filtered ? 'Ничего не найдено' : emptyText}</p>
      <p className="mt-1 text-sm text-slate-600">{context}</p>
      {filtered && (
        <Button variant="secondary" className="mt-4" onClick={onReset}>
          Сбросить фильтры
        </Button>
      )}
    </Card>
  );
}
