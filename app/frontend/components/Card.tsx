import type { HTMLAttributes } from 'react';

/** Заголовок карточки (h2). */
export const CARD_TITLE = 'text-base font-semibold text-slate-900';

/** Блок внутри карточки: плитки, списки, распределение баллов. Прозрачную рамку красит контрастная схема - плитки не сливаются с карточкой. */
export const PANEL = 'rounded-xl border border-transparent bg-slate-50 p-3 sm:p-4';

export type CardPadding = 'md' | 'sm' | 'lg' | 'none';

const PADDING: Record<CardPadding, string> = {
  md: 'p-4 sm:p-5',
  sm: 'p-3 sm:p-4',
  lg: 'p-6 sm:p-8',
  none: '',
};

/**
 * Карточка сайта — один вид на всех страницах и в скелетонах. Класс bg-white тёмная тема перекрашивает
 * в цвет поверхности (globals.css). sm — плотные списки, lg — вход, документы и ошибки, none — своя вёрстка.
 */
export default function Card({
  as: Tag = 'div',
  padding = 'md',
  className = '',
  ...props
}: HTMLAttributes<HTMLElement> & { as?: 'div' | 'section' | 'article'; padding?: CardPadding }) {
  return <Tag className={`rounded-2xl border border-slate-100 bg-white shadow-sm ${PADDING[padding]} ${className}`} {...props} />;
}
