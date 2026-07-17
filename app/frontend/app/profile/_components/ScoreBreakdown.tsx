import dynamic from 'next/dynamic';
import Link from 'next/link';

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
    <div className="mt-6 flex flex-col gap-5 lg:grid lg:grid-cols-3">
      <div className="col-span-2 rounded-2xl border border-slate-100 bg-white p-4 sm:p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Диаграмма распределения баллов
        </p>
        <div className="relative h-64 sm:h-80">
          <RadarChart labels={radarLabels} data={radarData} />
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:p-5">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Распределение баллов по видам деятельности
        </p>
        <div className="space-y-2.5">
          {radarLabels.map(
            (label: string, index: number) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-xl bg-sky-50 px-3 py-2 text-xs text-slate-800 sm:text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-sky-700" />
                  <span>{label}</span>
                </div>
                <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-sky-700 shadow-sm">
                  {radarData[index]}
                </span>
              </div>
            )
          )}
        </div>
        {isOwner && (
          <div className="mt-6 flex justify-center ">
            <button className='bg-emerald-600 rounded-full hover:bg-emerald-700 transition shadow-emerald-300 shadow-lg'>
              <Link
              href="/upload_achievement"
              className="inline-flex items-center rounded-full justify-center px-5 py-2.5 text-sm font-semibold text-white "
              >
              Загрузить новое достижение
            </Link>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
