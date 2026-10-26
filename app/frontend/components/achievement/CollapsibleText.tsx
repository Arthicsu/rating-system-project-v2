'use client';

import { useLayoutEffect, useRef, useState } from 'react';

interface CollapsibleTextProps {
  text: string;
  /** Сколько строк видно в свёрнутом виде. */
  lines?: number;
}

/**
 * Длинный текст свёрнут до `lines` строк; кнопка «Показать полностью / Свернуть» появляется,
 * только если текст действительно обрезан (меряется ResizeObserver — и при смене ширины).
 */
export default function CollapsibleText({ text, lines = 4 }: CollapsibleTextProps) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    // Развёрнутый текст не обрезан по определению: мерить нечего, кнопка «Свернуть» остаётся.
    if (!el || expanded) return;
    const measure = () => setClamped(el.scrollHeight > el.clientHeight + 1);
    // Сразу после раскладки (до отрисовки) и потом при каждой смене ширины.
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    // После загрузки веб-шрифта строки переносятся иначе, а высота блока прежняя — RO молчит.
    let alive = true;
    void document.fonts?.ready.then(() => alive && measure());
    return () => {
      alive = false;
      observer.disconnect();
    };
  }, [text, expanded]);

  return (
    <div>
      <p
        ref={ref}
        className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-900 sm:text-base"
        style={expanded ? undefined : { display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
      >
        {text}
      </p>
      {(clamped || expanded) && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="cursor-pointer mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-sky-700 hover:text-sky-900"
        >
          {expanded ? 'Свернуть' : 'Показать полностью'}
        </button>
      )}
    </div>
  );
}
