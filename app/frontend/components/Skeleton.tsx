import type { ReactNode } from 'react';

/** Кость скелетона: размер и скругление - классами, цвет и блик - из темы (.bone в globals.css). */
export function Bone({ className = '' }: { className?: string }) {
  return <span className={`bone ${className}`} />;
}

/** Строка текста: её высоту задаёт тот же text-* класс, что у настоящего текста. */
export function BoneLine({ className = '' }: { className?: string }) {
  return <span className={`bone bone-line ${className}`} />;
}

/** Скелетон блока или страницы: проявляется через 150 мс; скринридер слышит «Загрузка…», кости от него скрыты. */
export function SkeletonScreen({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div role="status" className={`skeleton-screen ${className}`}>
      <span className="sr-only">Загрузка…</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}
