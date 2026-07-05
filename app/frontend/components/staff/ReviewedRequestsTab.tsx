'use client';

import SearchInput from '@/components/SearchInput';
import Pagination from '@/components/Pagination';
import RequestCard from '@/components/staff/RequestCard';
import RequestCardsSkeleton from '@/components/staff/RequestCardsSkeleton';
import type { Document } from '@/interfaces/StaffInterfaces';

interface ReviewedRequestsTabProps {
  docs: Document[];
  loading: boolean;
  totalReviewed: number;
  reviewedPage: number;
  requestsPageSize: number;
  currentGroupName: string;
  semesterLabel: string;
  onSearch: (value: string) => void;
  onPageChange: (page: number) => void;
  onApprove: (doc: Document) => void;
  onReject: (doc: Document) => void;
}

/** Вкладка «Рассмотренные заявки». JSX перенесён дословно из staff-profile/page.tsx. */
export default function ReviewedRequestsTab({
  docs,
  loading,
  totalReviewed,
  reviewedPage,
  requestsPageSize,
  currentGroupName,
  semesterLabel,
  onSearch,
  onPageChange,
  onApprove,
  onReject,
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

      {loading && docs.length === 0 ? (
        <RequestCardsSkeleton />
      ) : docs.length > 0 ? (
        <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 transition-opacity duration-300 ${loading ? 'opacity-40' : 'opacity-100'}`}>
          {docs.map((doc) => (
            <RequestCard
              key={doc.id}
              doc={doc}
              variant="reviewed"
              onApprove={onApprove}
              onReject={onReject}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-sm text-sky-700">
            Нет рассмотренных заявок за период &quot;{semesterLabel}&quot; в группе &quot;{currentGroupName}&quot;
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
