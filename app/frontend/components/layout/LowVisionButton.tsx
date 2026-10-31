'use client';

import HeaderPopover from '@/components/layout/HeaderPopover';
import LowVisionSettings from '@/components/LowVisionSettings';
import { useLowVision } from '@/hooks/useLowVision';

/** Кнопка с очками, как на ЭОС: версия для слабовидящих - для всех, и без входа. Тема - в «Настройках». */
export default function LowVisionButton() {
  const { settings } = useLowVision();

  return (
    <HeaderPopover
      id="low-vision-panel"
      label="Версия для слабовидящих"
      // Пока версия для слабовидящих включена, кнопка подсвечена: видно, где её выключить.
      buttonClassName={`inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-lg text-orange-600 transition hover:bg-orange-50 active:scale-95 motion-reduce:transition-none dark:text-orange-400 dark:hover:bg-orange-950/40 ${
        settings.enabled ? 'bg-orange-50 ring-2 ring-orange-600 dark:bg-orange-950/40 dark:ring-orange-400' : ''
      }`}
      panelClassName="sm:w-95"
      button={<i className="fa-solid fa-glasses" aria-hidden="true" />}
    >
      <div className="p-2">
        <LowVisionSettings />
      </div>
    </HeaderPopover>
  );
}
