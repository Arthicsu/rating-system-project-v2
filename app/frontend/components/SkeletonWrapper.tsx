
import React from 'react';

interface SkeletonWrapperProps {
  isLoading: boolean;
  variant?: 'table' | 'cards' | 'text';
  count?: number; 
  children: React.ReactNode;
}

export default function SkeletonWrapper({
  isLoading,
  variant = 'text',
  count = 3,
  children,
}: SkeletonWrapperProps) {
  if (!isLoading) return <>{children}</>;

  const pulseClass = "animate-pulse bg-slate-200 rounded";

  return (
    <>
      {variant === 'table' && (
        <div className="w-full space-y-3 p-4 bg-white rounded-xl border border-slate-100">
          {/* Имитируем шапку таблицы */}
          <div className="flex space-x-4 border-b border-slate-100 pb-3">
            <div className={`h-4 w-1/4 ${pulseClass}`} />
            <div className={`h-4 w-1/4 ${pulseClass}`} />
            <div className={`h-4 w-1/4 ${pulseClass}`} />
            <div className={`h-4 w-1/4 ${pulseClass}`} />
          </div>
          {/* Имитируем строки (количество зависит от count) */}
          {[...Array(count)].map((_, i) => (
            <div key={i} className="flex space-x-4 py-2">
              <div className={`h-8 w-1/4 ${pulseClass} opacity-80`} />
              <div className={`h-8 w-1/4 ${pulseClass} opacity-80`} />
              <div className={`h-8 w-1/4 ${pulseClass} opacity-80`} />
              <div className={`h-8 w-1/4 ${pulseClass} opacity-80`} />
            </div>
          ))}
        </div>
      )}

      {variant === 'cards' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(count)].map((_, i) => (
            <div key={i} className="p-5 bg-white border border-slate-200 rounded-xl space-y-4 shadow-sm animate-pulse">
              <div className="flex justify-between items-center">
                <div className="h-4 w-1/3 bg-slate-200 rounded" />
                <div className="h-4 w-1/4 bg-slate-200 rounded" />
              </div>
              <div className="h-6 w-3/4 bg-slate-300 rounded" />
              <div className="space-y-2">
                <div className="h-3 w-full bg-slate-100 rounded" />
                <div className="h-3 w-5/6 bg-slate-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {variant === 'text' && (
        <div className="space-y-2.5 animate-pulse">
          {[...Array(count)].map((_, i) => (
            <div key={i} className={`h-4 w-full ${pulseClass}`} style={{ width: i === count - 1 ? '70%' : '100%' }} />
          ))}
        </div>
      )}
    </>
  );
}