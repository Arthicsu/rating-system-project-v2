'use client';

import { useState } from 'react';

import SearchInput from '@/components/SearchInput';
import Pagination from '@/components/Pagination';
import RequestCard from './RequestCard';
import RequestCardsSkeleton from './RequestCardsSkeleton';
import StateFilter from './StateFilter';
import EmptyRequests from './EmptyRequests';
import type { Document, ReviewAction } from '@/interfaces/StaffInterfaces';

const STATE_OPTIONS = [
  { value: 'all', label: 'Все' },
  { value: 'new', label: 'Новые' },
  { value: 'returned', label: 'Повторные и возвращённые' },
];

interface PendingRequestsTabProps {
  docs: Document[];
  loading: boolean;
  totalRequests: number;
  requestsPage: number;
  requestsPageSize: number;
  currentGroupName: string;
  periodLabel: string;
  /** «Заявки» у кафедры, «На контроле» у руководства. */
  title: string;
  /** Пояснение под заголовком (у руководства — что значит «На контроле»). */
  hint?: string;
  /** Новые/повторные - только у кафедры: у декана и ректората здесь лишь одобренные кафедрой. */
  showStateFilter: boolean;
  stateValue: string;
  onStateChange: (value: string) => void;
  /** Уже применённый поиск - поле показывает его после смены вкладки и при открытии по ссылке. */
  searchValue: string;
  onSearch: (value: string) => void;
  /** Сброс таблетки и поиска (кнопка «Сбросить фильтры» в пустом списке). */
  onResetFilters: () => void;
  onPageChange: (page: number) => void;
  actionsFor: (doc: Document) => ReviewAction[];
  onAction: (action: ReviewAction, doc: Document) => void;
}

/** Вкладка «Заявки на рассмотрение» (у руководства — «На контроле»). */
export default function PendingRequestsTab({
  docs,
  loading,
  totalRequests,
  requestsPage,
  requestsPageSize,
  currentGroupName,
  periodLabel,
  title,
  hint,
  showStateFilter,
  stateValue,
  onStateChange,
  searchValue,
  onSearch,
  onResetFilters,
  onPageChange,
  actionsFor,
  onAction,
}: PendingRequestsTabProps) {
  const filtered = (showStateFilter && stateValue !== 'all') || !!searchValue;
  // Сброс очищает и поле поиска: SearchInput берёт значение только при монтировании.
  const [searchKey, setSearchKey] = useState(0);
  const resetFilters = () => {
    onResetFilters();
    setSearchKey((k) => k + 1);
  };
  return (
    <div className="mt-5 space-y-4 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 sm:text-base">
            {title}: {currentGroupName}, {periodLabel}
          </h2>
          {hint && <p className="mt-1 text-xs text-slate-600 sm:text-sm">{hint}</p>}
        </div>
        <div className="w-full sm:w-64">
          <SearchInput key={searchKey} initialValue={searchValue} onSearch={onSearch} placeholder="ФИО, зачётка или название" />
        </div>
      </div>

      {showStateFilter && (
        <StateFilter label="Какие заявки показать" options={STATE_OPTIONS} value={stateValue} onChange={onStateChange} />
      )}

      {loading && docs.length === 0 ? (
        <RequestCardsSkeleton />
      ) : docs && docs.length > 0 ? (
        <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 transition-opacity duration-300 ${loading ? 'opacity-40' : 'opacity-100'}`}>
          {docs.map((doc) => (
            <RequestCard
              key={doc.id}
              doc={doc}
              variant="pending"
              actions={actionsFor(doc)}
              onAction={onAction}
            />
          ))}
        </div>
      ) : (
        <EmptyRequests
          filtered={filtered}
          emptyText={showStateFilter ? 'Все заявки рассмотрены' : 'Нет заявок на контроле'}
          context={`${periodLabel} · ${currentGroupName}`}
          onReset={resetFilters}
        />
      )}

      <Pagination
        page={requestsPage}
        totalCount={totalRequests}
        pageSize={requestsPageSize}
        loading={loading}
        onPageChange={onPageChange}
      />
    </div>
  );
}
