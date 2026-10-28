'use client';

import { useSyncExternalStore } from 'react';
import {Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend, } from 'chart.js';
import { Radar } from 'react-chartjs-2';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

interface RadarChartProps {
  labels: string[];
  data: number[];
}

// Тема и оформление меняют атрибуты <html>; после смены диаграмма перечитывает цвета палитры.
const subscribeToRoot = (onChange: () => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true });
  return () => observer.disconnect();
};
const rootAttributes = () =>
  Array.from(document.documentElement.attributes, (attr) => `${attr.name}=${attr.value}`).join(' ');

// Уже 640px полные названия не помещаются по ширине - короткие, как в таблице по семестрам.
const NARROW = '(max-width: 639px)';
const SHORT_LABELS: Record<string, string> = {
  'Научно-исследовательская': 'Научная',
  'Культурно-творческая': 'Творч.',
  Общественная: 'Обществ.',
};
const subscribeToNarrow = (onChange: () => void) => {
  const query = window.matchMedia(NARROW);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};

/** «Научно-исследовательская» и т.п. - в две строки по дефису. */
const splitLabel = (label: string) => {
  const hyphen = label.indexOf('-');
  return hyphen > 0 ? [label.slice(0, hyphen + 1), label.slice(hyphen + 1)] : label;
};

/**
 * Радарная диаграмма баллов профиля. Вынесена из StudentProfile и грузится
 * через next/dynamic (ssr: false) — chart.js не попадает в общий бандл.
 */
export default function RadarChart({ labels, data }: RadarChartProps) {
  useSyncExternalStore(subscribeToRoot, rootAttributes, () => '');
  const narrow = useSyncExternalStore(subscribeToNarrow, () => window.matchMedia(NARROW).matches, () => false);
  const css = getComputedStyle(document.documentElement);
  const color = (name: string) => css.getPropertyValue(name).trim();
  // Версия для слабовидящих: контрастная схема задаёт один цвет, шрифт подписей растёт вместе с текстом.
  const schemeColor = color('--lv-fg');
  // Полные названия не помещаются и при крупном шрифте; сами подписи растут не больше чем в 1,5 раза.
  const textScale = Math.min(Number(color('--lv-scale')) || 1, 1.5);
  const short = narrow || textScale >= 1.5;
  const brand = schemeColor || color('--color-sky-700');

  const chartData = {
    labels: labels.map((label) => (short ? (SHORT_LABELS[label] ?? label) : splitLabel(label))),
    datasets: [
      {
        label: 'Баллы',
        data,
        backgroundColor: `color-mix(in oklab, ${brand} 35%, transparent)`,
        borderColor: brand,
        borderWidth: 2,
        pointBackgroundColor: brand,
        pointBorderColor: brand,
        pointHoverBackgroundColor: brand,
        pointHoverBorderColor: brand,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        angleLines: { display: true, color: schemeColor || color('--color-slate-300') },
        grid: { color: schemeColor || color('--color-slate-200') },
        suggestedMin: 0,
        suggestedMax: 15,
        pointLabels: {
          color: schemeColor || color('--color-slate-600'),
          font: { size: Math.round((short ? 11 : 13) * textScale), weight: 'bold' as const },
        },
        ticks: {
          display: false,
        },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items: { dataIndex: number }[]) => labels[items[0]?.dataIndex] ?? '',
        },
      },
    },
  };

  return <Radar data={chartData} options={options} />;
}
