'use client';

import SearchInput from '@/components/SearchInput';
import Pagination from '@/components/Pagination';
import RequestCard from './RequestCard';
import RequestCardsSkeleton from './RequestCardsSkeleton';
import type { Document } from '@/interfaces/StaffInterfaces';

interface PendingRequestsTabProps {
  docs: Document[];
  loading: boolean;
  totalRequests: number;
  requestsPage: number;
  requestsPageSize: number;
  currentGroupName: string;
  semesterLabel: string;
  canApprove: boolean;
  onSearch: (value: string) => void;
  onPageChange: (page: number) => void;
  onApprove: (doc: Document) => void;
  onReject: (doc: Document) => void;
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
  canApprove,
  onSearch,
  onPageChange,
  onApprove,
  onReject,
}: PendingRequestsTabProps) {
  return (
    <div className="mt-5 space-y-4 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold text-slate-900 sm:text-base">
          Заявки: {currentGroupName}, {semesterLabel}
        </h2>
        <div className="w-full sm:w-64">
          <SearchInput onSearch={onSearch} placeholder="Поиск по ФИО..." />
        </div>
      </div>

      {loading && docs.length === 0 ? (
        <RequestCardsSkeleton />
      ) : docs && docs.length > 0 ? (
        <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 transition-opacity duration-300 ${loading ? 'opacity-40' : 'opacity-100'}`}>
          {docs.map((doc) => (
            <RequestCard
              key={doc.id}
              doc={doc}
              variant="pending"
              canApprove={canApprove}
              onApprove={onApprove}
              onReject={onReject}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-sm text-sky-700">
            Нет заявок за период &quot;{semesterLabel}&quot; в группе &quot;{currentGroupName}&quot;
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
