import dynamic from 'next/dynamic';
import Link from 'next/link';
import { buttonClass } from '@/components/Button';
import Card, { CARD_TITLE, PANEL } from '@/components/Card';
import CountUp from '@/components/CountUp';

// chart.js грузим только на клиенте и только когда профиль реально рендерится —
// не тащим его в общий бандл.
const RadarChart = dynamic(() => import('@/components/profile/RadarChart'), {
  ssr: false,
  loading: () => null,
});

interface ScoreBreakdownProps {
  radarLabels: string[];
  radarData: number[];
  isOwner: boolean;
}

/** Диаграмма и распределение баллов по видам деятельности + CTA загрузки. */
export default function ScoreBreakdown({ radarLabels, radarData, isOwner }: ScoreBreakdownProps) {
  return (
    <Card as="section" aria-labelledby="score-breakdown-title">
      <h2 id="score-breakdown-title" className={`mb-3 ${CARD_TITLE}`}>
        Баллы по видам деятельности
      </h2>
      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-3">
        {/* Холст Chart.js до первого замера - 300px шириной: без обрезки он на миг шире телефона. */}
        <div className="relative h-64 overflow-hidden lg:col-span-2">
          <RadarChart labels={radarLabels} data={radarData} />
        </div>

        {/* Колонка flex: кнопка в ней - блок, её высота не зависит от межстрочного интервала. */}
        <div className={`flex flex-col gap-2 ${PANEL}`}>
          {radarLabels.map((label: string, index: number) => (
            <div
              key={label}
              className="flex items-center justify-between gap-2 rounded-xl bg-sky-50 px-3 py-1.5 text-xs text-slate-800 sm:text-sm"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-sky-700" />
                <span className="min-w-0 wrap-break-word">{label}</span>
              </div>
              <span className="shrink-0 rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-sky-700 shadow-sm">
                <CountUp value={radarData[index]} />
              </span>
            </div>
          ))}
          {isOwner && (
            <Link href="/upload-achievement" className={`${buttonClass()} mt-2 w-full`}>
              Загрузить новое достижение
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}
