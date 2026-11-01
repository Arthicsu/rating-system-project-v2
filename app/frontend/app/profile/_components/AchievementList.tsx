'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import EmptyRequests from '@/components/EmptyRequests';
import Pagination from '@/components/Pagination';
import StateFilter from '@/components/StateFilter';
import TabsNav from '@/components/TabsNav';
import type { Achievement } from '@/interfaces/AchievementInterfaces';
import AchievementItem from './AchievementItem';
import { PAGE_SIZE, STATUS_TABS, listAchievements, listQuery, readListState, type ListState, type StatusTab } from './achievementFilter';

const TAB_LABELS: Record<StatusTab, string> = {
  all: 'Все',
  approved: 'Подтверждённые',
  pending: 'На рассмотрении',
  rejected: 'Отклонённые',
};

const CARD = 'rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5';
const TITLE = 'mb-3 text-sm font-semibold text-slate-700 sm:text-base';

interface AchievementListProps {
  docs: Achievement[];
  /** Подписи текущих категорий (radar_stats.labels): все, и без заявок. */
  categoryLabels: string[];
  isOwner: boolean;
  onEdit?: (doc: Achievement) => void;
  onDelete?: (doc: Achievement) => void;
}

/**
 * Лента заявок студента: вкладки статуса, таблетки категорий и страницы по 10. Состояние живёт
 * только в адресе: «Назад» из заявки и обновление страницы возвращают ту же вкладку и страницу.
 */
export default function AchievementList({ docs, categoryLabels, isOwner, onEdit, onDelete }: AchievementListProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const panelRef = useRef<HTMLDivElement>(null);

  // Код категории есть только у заявок; категорию без заявок выбрать нельзя, и код ей не нужен.
  const codes = new Map(docs.map((d) => [d.category_display, d.category_code]));
  const labels = categoryLabels.length > 0 ? categoryLabels : [...codes.keys()];
  const state = readListState(searchParams, [...codes.values()]);
  const { items, total, page, pages, statusCounts, categoryCounts } = listAchievements(docs, state);

  const update = (next: Partial<ListState>) => {
    const query = listQuery({ ...state, page: 1, ...next });
    // History API, как в кабинете сотрудника: без запроса к серверу, useSearchParams Next обновит сам.
    window.history.replaceState(null, '', query ? `${pathname}?${query}` : pathname);
  };

  const changePage = (next: number) => {
    update({ page: next });
    const panel = panelRef.current;
    if (!panel) return;
    // Фокус - в начало ленты: кнопка «вперёд» на последней странице выключится и потеряла бы его.
    panel.focus({ preventScroll: true });
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    panel.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  if (docs.length === 0) {
    return (
      <section aria-labelledby="achievements-title" className={CARD}>
        <h2 id="achievements-title" className={TITLE}>Достижения</h2>
        <div className="py-6 text-center">
          <p className="text-base font-semibold text-slate-900">Пока нет достижений</p>
          {isOwner && (
            <Link
              href="/upload-achievement"
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-sky-700 px-5 text-sm font-semibold text-white transition hover:bg-sky-800 motion-reduce:transition-none"
            >
              Загрузить достижение
            </Link>
          )}
        </div>
      </section>
    );
  }

  const categoryOptions = [
    { value: 'all', label: 'Все категории', count: categoryCounts.get('all') ?? 0 },
    ...labels.map((label) => {
      const code = codes.get(label);
      const count = code ? (categoryCounts.get(code) ?? 0) : 0;
      // Выбранная таблетка не гаснет и при нуле после смены вкладки - видно, что фильтр включён.
      return { value: code ?? label, label, count, disabled: count === 0 && code !== state.category };
    }),
  ];

  return (
    <section aria-labelledby="achievements-title" className={CARD}>
      <h2 id="achievements-title" className={TITLE}>Достижения</h2>
      <TabsNav
        label="Статус заявок"
        panelId="achievements-panel"
        tabs={STATUS_TABS.map((id) => ({ id, label: TAB_LABELS[id], badge: statusCounts[id], badgeTone: 'neutral' as const }))}
        activeTab={state.status}
        onChange={(id) => update({ status: id as StatusTab })}
      />
      <div className="mt-3">
        <StateFilter
          label="Категория"
          options={categoryOptions}
          value={state.category}
          onChange={(category) => update({ category })}
        />
      </div>

      <div
        ref={panelRef}
        id="achievements-panel"
        role="tabpanel"
        aria-labelledby={`tab-${state.status}`}
        tabIndex={-1}
        className="mt-4 scroll-mt-20 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
      >
        {total === 0 ? (
          <EmptyRequests
            filtered
            emptyText="Пока нет достижений"
            context="Нет заявок с выбранным статусом и категорией"
            onReset={() => update({ status: 'all', category: 'all' })}
          />
        ) : (
          <div key={`${state.status}|${state.category}|${page}`} className="animate-fade-in space-y-3">
            {items.map((doc) => {
              const editable = doc.status_display !== 'approved';
              return (
                <AchievementItem
                  key={doc.id}
                  doc={doc}
                  onEdit={editable ? onEdit : undefined}
                  onDelete={editable ? onDelete : undefined}
                />
              );
            })}
          </div>
        )}
        {pages > 1 && (
          <div className="mt-4">
            <Pagination page={page} totalCount={total} pageSize={PAGE_SIZE} onPageChange={changePage} />
          </div>
        )}
      </div>
    </section>
  );
}
