import { ViewTransition } from 'react';

/**
 * Новая страница: шаблон монтируется заново при каждой смене маршрута, и ViewTransition растворяет
 * старую страницу в новую. Где браузер не умеет View Transitions, страница проявляется сама
 * (animate-page-in, в остальных браузерах выключено в CSS). update="none": вкладки, фильтры и
 * страницы списка пишут своё состояние в адрес, и на эти обновления переход не запускается.
 * flex-col: короткая страница по-прежнему может встать по центру (my-auto).
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition update="none">
      <div className="flex flex-1 flex-col animate-page-in">{children}</div>
    </ViewTransition>
  );
}
