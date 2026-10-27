'use client';

import type { PastPendingDto } from '@/lib/api';

interface PastPendingNoticeProps {
  items: PastPendingDto[];
  /** Переключить «Период» на учебный год и открыть заявки. */
  onPick: (yearStart: number) => void;
}

/** Заметка кафедре: в прошлых учебных годах остались заявки без решения. */
export default function PastPendingNotice({ items, onPick }: PastPendingNoticeProps) {
  if (items.length === 0) return null;
  return (
    <section
      aria-label="Нерассмотренные заявки прошлых учебных лет"
      className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
    >
      <p className="font-medium">Остались нерассмотренные заявки прошлых учебных лет:</p>
      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
        {items.map((item) => (
          <li key={item.year_start}>
            <button
              type="button"
              onClick={() => onPick(item.year_start)}
              className="inline-flex min-h-11 cursor-pointer items-center underline decoration-amber-400 underline-offset-2 hover:text-amber-900 sm:min-h-0"
            >
              {item.label} — {item.count}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
