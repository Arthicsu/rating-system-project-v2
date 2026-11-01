/**
 * Кружок загрузки: проявляется через 150 мс (быстрая загрузка не мигает). Подпись - для скринридера,
 * с visibleLabel - и под кружком.
 */
export default function Spinner({
  label = 'Загрузка…',
  visibleLabel = false,
  className = '',
}: {
  label?: string;
  visibleLabel?: boolean;
  className?: string;
}) {
  return (
    <span role="status" className={`delayed-appear inline-flex flex-col items-center gap-3 ${className}`}>
      <span aria-hidden="true" data-lv-keep className="spinner" />
      <span className={visibleLabel ? 'text-sm text-slate-500' : 'sr-only'}>{label}</span>
    </span>
  );
}
