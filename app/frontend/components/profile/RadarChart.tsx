'use client';

import {Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend, } from 'chart.js';
import { Radar } from 'react-chartjs-2';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

interface RadarChartProps {
  labels: string[];
  data: number[];
}

/**
 * Радарная диаграмма баллов профиля. Вынесена из StudentProfile и грузится
 * через next/dynamic (ssr: false) — chart.js не попадает в общий бандл.
 */
export default function RadarChart({ labels, data }: RadarChartProps) {
  const chartData = {
    labels,
    datasets: [
      {
        label: 'Баллы',
        data,
        backgroundColor: 'rgba(0, 80, 207, 0.35)',
        borderColor: '#0069a8',
        borderWidth: 2,
        pointBackgroundColor: '#0069a8',
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        angleLines: { display: true, color: 'rgba(0,0,0,0.12)' },
        grid: { color: 'rgba(0,0,0,0.08)' },
        suggestedMin: 0,
        suggestedMax: 15,
        pointLabels: {
          font: { size: 13, weight: 'bold' as const },
        },
        ticks: {
          display: false,
        },
      },
    },
    plugins: {
      legend: { display: false },
    },
  };

  return <Radar data={chartData} options={options} />;
}
