'use client';

import { useEffect, useRef, useState } from 'react';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Число набегает от прежнего значения (сначала от нуля) за 0,7 с; при reduced motion - сразу, со следующего кадра. */
export default function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  const from = useRef(shown);

  useEffect(() => {
    const start = from.current;
    from.current = value;
    const began = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = reducedMotion() ? 1 : Math.min((now - began) / 700, 1);
      setShown(Math.round(start + (value - start) * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <span className="tabular-nums">{shown}</span>;
}
