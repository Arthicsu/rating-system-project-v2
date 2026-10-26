'use client';

import SearchInput from '@/components/SearchInput';
import Pagination from '@/components/Pagination';
import RequestCard from './RequestCard';
import RequestCardsSkeleton from './RequestCardsSkeleton';
import StateFilter from './StateFilter';
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
  semesterLabel: string;
  /** Новые/повторные - только у кафедры: у декана и ректората здесь лишь подтверждённые кафедрой. */
  showStateFilter: boolean;
  stateValue: string;
  onStateChange: (value: string) => void;
  /** Уже применённый поиск - поле показывает его после смены вкладки и при открытии по ссылке. */
  searchValue: string;
  onSearch: (value: string) => void;
  onPageChange: (page: number) => void;
  actionsFor: (doc: Document) => ReviewAction[];
  onAction: (action: ReviewAction, doc: Document) => void;
}

/** Вкладка «Заявки на подтверждение». */
export default function PendingRequestsTab({
  docs,
  loading,
  totalRequests,
  requestsPage,
  requestsPageSize,
  currentGroupName,
  semesterLabel,
  showStateFilter,
  stateValue,
  onStateChange,
  searchValue,
  onSearch,
  onPageChange,
  actionsFor,
  onAction,
}: PendingRequestsTabProps) {
  const filtered = showStateFilter && stateValue !== 'all';
  return (
    <div className="mt-5 space-y-4 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold text-slate-900 sm:text-base">
          Заявки: {currentGroupName}, {semesterLabel}
        </h2>
        <div className="w-full sm:w-64">
          <SearchInput initialValue={searchValue} onSearch={onSearch} placeholder="Поиск по ФИО..." />
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
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-sm text-sky-700">
            {filtered ? 'Нет заявок по выбранному фильтру' : 'Нет заявок'} за период &quot;{semesterLabel}&quot; в группе &quot;{currentGroupName}&quot;
          </p>
        </div>
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
