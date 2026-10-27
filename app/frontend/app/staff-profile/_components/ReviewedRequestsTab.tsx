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
  { value: 'approved', label: 'Одобренные' },
  { value: 'rejected', label: 'Отклонённые' },
];

interface ReviewedRequestsTabProps {
  docs: Document[];
  loading: boolean;
  totalReviewed: number;
  reviewedPage: number;
  requestsPageSize: number;
  currentGroupName: string;
  periodLabel: string;
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

/** Вкладка «Рассмотренные заявки». */
export default function ReviewedRequestsTab({
  docs,
  loading,
  totalReviewed,
  reviewedPage,
  requestsPageSize,
  currentGroupName,
  periodLabel,
  stateValue,
  onStateChange,
  searchValue,
  onSearch,
  onResetFilters,
  onPageChange,
  actionsFor,
  onAction,
}: ReviewedRequestsTabProps) {
  const filtered = stateValue !== 'all' || !!searchValue;
  // Сброс очищает и поле поиска: SearchInput берёт значение только при монтировании.
  const [searchKey, setSearchKey] = useState(0);
  const resetFilters = () => {
    onResetFilters();
    setSearchKey((k) => k + 1);
  };
  return (
    <div className="mt-5 space-y-4 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold text-slate-900 sm:text-base">
          Рассмотренные: {currentGroupName}, {periodLabel}
        </h2>
        <div className="w-full sm:w-64">
          <SearchInput key={searchKey} initialValue={searchValue} onSearch={onSearch} placeholder="ФИО, зачётка или название" />
        </div>
      </div>

      <StateFilter label="Какие решения показать" options={STATE_OPTIONS} value={stateValue} onChange={onStateChange} />

      {loading && docs.length === 0 ? (
        <RequestCardsSkeleton />
      ) : docs.length > 0 ? (
        <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 transition-opacity duration-300 ${loading ? 'opacity-40' : 'opacity-100'}`}>
          {docs.map((doc) => (
            <RequestCard
              key={doc.id}
              doc={doc}
              variant="reviewed"
              actions={actionsFor(doc)}
              onAction={onAction}
            />
          ))}
        </div>
      ) : (
        <EmptyRequests
          filtered={filtered}
          emptyText="Рассмотренных заявок пока нет"
          context={`${periodLabel} · ${currentGroupName}`}
          onReset={resetFilters}
        />
      )}

      <Pagination
        page={reviewedPage}
        totalCount={totalReviewed}
        pageSize={requestsPageSize}
        loading={loading}
        onPageChange={onPageChange}
      />
    </div>
  );
}
