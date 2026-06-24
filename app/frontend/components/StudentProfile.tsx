'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import {Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend, } from 'chart.js';
import Link from 'next/link';
import { Radar } from 'react-chartjs-2';
import AchievementItem from '@/components/AchievementItem';
import ModalConfirm from '@/components/modals/modalConfirm';
import ModalEditAchievement from '@/components/modals/modalEditAchievement';
import { studentApi } from '@/lib/apiRequests';
import type { StudentProfileProps } from '@/interfaces/ProfileInterfaces';
import type { Achievement } from '@/interfaces/AchievementInterfaces';
import { Skeleton } from 'boneyard-js/react';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

export default function StudentProfile({ profile, isOwner, loading = false, onRefresh }: StudentProfileProps) {
  const [editingDoc, setEditingDoc] = useState<Achievement | null>(null);
  const [deletingDoc, setDeletingDoc] = useState<Achievement | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteConfirm = async () => {
    if (!deletingDoc) return;
    // Подтверждённое достижение удалять нельзя (дублирует запрет на сервере).
    if (deletingDoc.status_display === 'approved') {
      toast.error('Нельзя удалить подтверждённое достижение');
      setDeletingDoc(null);
      return;
    }
    setDeleting(true);
    try {
      await studentApi.deleteAchievement(deletingDoc.id);
      toast.success('Достижение удалено');
      setDeletingDoc(null);
      onRefresh?.();
    } catch (error) {
      const err = error as { response?: { data?: { detail?: string } } };
      toast.error(err.response?.data?.detail ?? 'Не удалось удалить достижение');
    } finally {
      setDeleting(false);
    }
  };
  const data = {
    labels: profile.radar_stats.labels,
    datasets: [
      {
        label: 'Баллы',
        data: profile.radar_stats.data,
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

  const documents: Achievement[] = profile?.documents || [];
  const approvedDocs = documents.filter((d) => d.status_display === 'approved');
  const pendingDocs = documents.filter((d) => d.status_display === 'pending');
  const rejectedDocs = documents.filter((d) => d.status_display === 'rejected');

  if (loading) {
    return (
      <Skeleton name="student-profile" loading={false}>
        <section className="min-h-screen bg-slate-50 pt-24 pb-10">
          <div className="mx-auto max-w-350 px-4 sm:px-5">
            <div className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5 animate-pulse">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-3">
                  <div className="h-6 w-48 rounded bg-slate-200" />
                  <div className="h-4 w-32 rounded bg-slate-200" />
                  <div className="h-4 w-40 rounded bg-slate-200" />
                </div>
                <div className="h-16 w-24 rounded-xl bg-slate-200" />
              </div>
              <div className="mt-6 flex flex-col gap-5 lg:grid lg:grid-cols-3">
                <div className="col-span-2 space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:p-5">
                  <div className="h-4 w-40 rounded bg-slate-200" />
                  <div className="space-y-2">
                    <div className="h-8 rounded bg-slate-200" />
                    <div className="h-8 rounded bg-slate-200" />
                    <div className="h-8 rounded bg-slate-200" />
                  </div>
                </div>
                <div className="h-72 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:p-5">
                  <div className="h-4 w-40 rounded bg-slate-200" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </Skeleton>
    );
  }

  if (!profile) {
    return (
      <section className="min-h-screen bg-slate-50 pt-24 pb-10">
        <div className="mx-auto max-w-350 px-4 sm:px-5">
          <div className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5">
            <p className="text-center text-slate-500">Профиль не найден</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="min-h-screen bg-slate-50 pt-24 pb-10">
        <div className="mx-auto max-w-350 px-4 sm:px-5">
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_16px_50px_rgba(15,23,42,0.16)] sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1.5">
                <h1 className="text-lg font-semibold text-slate-900 sm:text-xl md:text-2xl">
                  {profile.full_name}
                </h1>
                <p className="text-xs text-slate-500 sm:text-sm">
                  Зачетная книжка:{' '}
                  <span className="font-medium text-slate-800">
                    {profile.record_book || '—'}
                  </span>
                </p>
                <p className="text-xs text-slate-500 sm:text-sm">
                  {profile.faculty}{' '}
                  <span className="mx-1 text-slate-300">•</span>
                  {profile.course} курс
                  <span className="mx-1 text-slate-300">•</span>
                  группа {profile.group}
                </p>
              </div>
              <div className="mt-2 flex items-center justify-start sm:mt-0 sm:justify-end">
                <div className="rounded-2xl border items-center border-sky-100 bg-sky-50 px-4 py-3 text-center shadow-sm">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    Общий балл
                  </div>
                  <div className="text-2xl font-bold text-sky-700 sm:text-3xl">
                    {profile.total_score}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-5 lg:grid lg:grid-cols-3">
              <div className="col-span-2 rounded-2xl border border-slate-100 bg-white p-4 sm:p-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Диаграмма распределения баллов
                </p>
                <div className="relative h-64 sm:h-80">
                  <Radar data={data} options={options} />
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:p-5">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Распределение баллов по видам деятельности
                </p>
                <div className="space-y-2.5">
                  {profile.radar_stats.labels.map(
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
                          {profile.radar_stats.data[index]}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-5">
            {approvedDocs.length > 0 && (
              <div className="rounded-2xl border border-slate-500/80 bg-slate-500/80 p-4 shadow-sm sm:p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <i className="fa-solid fa-check" />
                  </span>
                  <h2 className="text-sm font-semibold text-white sm:text-base">
                    Подтвержденные достижения
                  </h2>
                </div>
                <div className="space-y-3">
                  {approvedDocs.map((doc: Achievement) => (
                    <AchievementItem
                      key={doc.id}
                      doc={doc}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* {isOwner && pendingDocs.length > 0 && ( */}
            {pendingDocs.length > 0 && (
              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 shadow-sm sm:p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-white">
                    <i className="fa-regular fa-clock" />
                  </span>
                  <h2 className="text-sm font-semibold text-amber-900 sm:text-base">
                    Ожидающие подтверждения
                  </h2>
                </div>
                <div className="space-y-3">
                  {pendingDocs.map((doc: Achievement) => (
                    <AchievementItem
                      key={doc.id}
                      doc={doc}
                      onEdit={isOwner ? (d) => setEditingDoc(d) : undefined}
                      onDelete={isOwner ? (d) => setDeletingDoc(d) : undefined}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* {isOwner && rejectedDocs.length > 0 && ( */}
            {rejectedDocs.length > 0 && (
              <div className="rounded-2xl border border-rose-100 bg-rose-200 p-4 shadow-sm sm:p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-500 text-white">
                    <i className="fa-regular fa-circle-xmark" />
                  </span>
                  <h2 className="text-sm font-semibold text-rose-900 sm:text-base">
                    Отклоненные
                  </h2>
                </div>
                <div className="space-y-3">
                  {rejectedDocs.map((doc: Achievement) => (
                    <AchievementItem
                      key={doc.id}
                      doc={doc}
                      onEdit={isOwner ? (d) => setEditingDoc(d) : undefined}
                      onDelete={isOwner ? (d) => setDeletingDoc(d) : undefined}
                    />
                  ))}
                </div>
              </div>
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
      </section>

      <ModalEditAchievement
        isOpen={!!editingDoc}
        doc={editingDoc}
        onClose={() => setEditingDoc(null)}
        onSaved={() => { onRefresh?.(); }}
      />

      <ModalConfirm
        isOpen={!!deletingDoc}
        title="Удалить достижение?"
        message="Достижение будет удалено безвозвратно."
        confirmLabel="Удалить"
        danger
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeletingDoc(null)}
      />
    </>
  );
}