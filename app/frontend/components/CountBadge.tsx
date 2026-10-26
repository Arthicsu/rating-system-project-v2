/** «1 заявка», «3 заявки», «11 заявок». */
export function requestsWord(n: number) {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return 'заявка';
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return 'заявки';
  return 'заявок';
}

interface CountBadgeProps {
  count: number;
  /** alert — требует действия (кафедра); neutral — для сведения (руководство «На контроле»). */
  tone?: 'alert' | 'neutral';
  className?: string;
}

/**
 * Счётчик заявок: растёт под 2–3 цифры, больше 99 — «99+»; скринридер слышит
 * «N заявок», а не голое число. При 0 не показывается.
 */
export default function CountBadge({ count, tone = 'alert', className = '' }: CountBadgeProps) {
  if (count <= 0) return null;
  const colors = tone === 'alert' ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-800';
  return (
    <span
      className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold leading-none ${colors} ${className}`}
    >
      <span aria-hidden="true">{count > 99 ? '99+' : count}</span>
      <span className="sr-only">{`${count} ${requestsWord(count)}`}</span>
    </span>
  );
}
