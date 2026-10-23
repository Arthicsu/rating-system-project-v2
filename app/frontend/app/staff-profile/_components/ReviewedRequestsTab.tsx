'use client';

import SearchInput from '@/components/SearchInput';
import Pagination from '@/components/Pagination';
import RequestCard from './RequestCard';
import RequestCardsSkeleton from './RequestCardsSkeleton';
import StateFilter from './StateFilter';
import type { Document, ReviewAction } from '@/interfaces/StaffInterfaces';

const STATE_OPTIONS = [
  { value: 'all', label: 'Все' },
  { value: 'approved', label: 'Подтверждённые' },
  { value: 'rejected', label: 'Отклонённые' },
];

interface ReviewedRequestsTabProps {
  docs: Document[];
  loading: boolean;
  totalReviewed: number;
  reviewedPage: number;
  requestsPageSize: number;
  currentGroupName: string;
  semesterLabel: string;
  stateValue: string;
  onStateChange: (value: string) => void;
  onSearch: (value: string) => void;
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
  semesterLabel,
  stateValue,
  onStateChange,
  onSearch,
  onPageChange,
  actionsFor,
  onAction,
}: ReviewedRequestsTabProps) {
  return (
    <div className="mt-5 space-y-4 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold text-slate-900 sm:text-base">
          Рассмотренные: {currentGroupName}, {semesterLabel}
        </h2>
        <div className="w-full sm:w-64">
          <SearchInput onSearch={onSearch} placeholder="Поиск по ФИО..." />
        </div>
      </div>

      <StateFilter label="Какие решения показать" options={STATE_OPTIONS} value={stateValue} onChange={onStateChange} />

      {loading && docs.length === 0 ? (
        <RequestCardsSkeleton />
      ) : docs.length > 0 ? (
        <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 transition-opacity duration-300 ${loading ? 'opacity-40' : 'opacity-100'}`}>
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
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-sm text-sky-700">
            {stateValue !== 'all' ? 'Нет рассмотренных заявок по выбранному фильтру' : 'Нет рассмотренных заявок'} за период &quot;{semesterLabel}&quot; в группе &quot;{currentGroupName}&quot;
          </p>
        </div>
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
