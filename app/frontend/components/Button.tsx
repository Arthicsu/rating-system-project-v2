import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'approve' | 'danger' | 'return' | 'danger-outline';
export type ButtonSize = 'md' | 'sm' | 'icon';

const BASE =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg text-sm font-semibold transition ease-spring ' +
  'motion-safe:active:scale-97 motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 ' +
  'focus-visible:ring-sky-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ' +
  'aria-disabled:cursor-not-allowed aria-disabled:opacity-60';

// Только цвета, которые тёмная тема закрепляет в globals.css по именам этих классов.
const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-sky-700 text-white hover:bg-sky-800',
  secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900',
  approve: 'bg-emerald-700 text-white hover:bg-emerald-800',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
  return: 'bg-amber-700 text-white hover:bg-amber-800',
  'danger-outline': 'border border-rose-200 bg-white text-rose-700 hover:bg-rose-50',
};

// Только минимальная высота: крупный шрифт версии для слабовидящих растит кнопку.
const SIZES: Record<ButtonSize, string> = {
  md: 'min-h-11 px-4',
  sm: 'min-h-11 px-4 sm:min-h-9 sm:px-3',
  icon: 'min-h-11 min-w-11 sm:min-h-9 sm:min-w-9',
};

/** Классы кнопки сайта — и для <button>, и для ссылки-кнопки (`<Link className={buttonClass()}>`). */
export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md'): string {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]}`;
}

/** Кнопка сайта: вариант — смысл действия и цвет, размер — высота. */
export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button type={type} className={`${buttonClass(variant, size)} ${className}`} {...props} />;
}
