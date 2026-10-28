interface SwitchProps {
  checked: boolean;
  onToggle: () => void;
  labelledBy: string;
  describedBy?: string;
  /** Пока сохраняется: кнопка остаётся в фокусе, но не реагирует. */
  busy?: boolean;
}

/** Переключатель вкл/выкл: кнопка role="switch" с зоной нажатия 44px. */
export default function Switch({ checked, onToggle, labelledBy, describedBy, busy = false }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-disabled={busy}
      onClick={onToggle}
      className="relative inline-flex h-11 w-14 shrink-0 cursor-pointer items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 aria-disabled:cursor-wait aria-disabled:opacity-60"
    >
      <span
        className={`h-6 w-11 rounded-full transition-colors motion-reduce:transition-none ${checked ? 'bg-sky-700' : 'bg-slate-500'}`}
      />
      <span
        className={`absolute left-2 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${checked ? 'translate-x-5' : ''}`}
      />
    </button>
  );
}
