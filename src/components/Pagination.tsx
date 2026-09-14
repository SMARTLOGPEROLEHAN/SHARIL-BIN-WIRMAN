import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
  itemName?: string;
}

export default function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
  className = '',
  itemName = 'rekod'
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // If there are no items or only 1 item and totalPages is 1, still show count if totalItems > 0
  if (totalItems === 0) return null;

  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);

  // Generate page numbers with smart ellipsis
  const getPageNumbers = (): (number | string)[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }

    if (currentPage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  };

  const pages = getPageNumbers();

  const handlePageClick = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      onPageChange(page);
    }
  };

  return (
    <div 
      className={`flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-4 sm:px-6 bg-risda-card/90 border border-risda-border rounded-2xl shadow-sm backdrop-blur-md mt-6 ${className}`}
    >
      {/* Records info & Page size selector */}
      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-risda-text font-medium">
        <span>
          Memaparkan <span className="font-bold text-risda-orange">{startIndex} - {endIndex}</span> daripada <span className="font-bold text-risda-text">{totalItems}</span> {itemName}
        </span>

        {onPageSizeChange && totalItems > Math.min(...pageSizeOptions) && (
          <div className="flex items-center gap-1.5 ml-2 pl-3 border-l border-risda-border">
            <span className="text-[11px] text-risda-muted uppercase font-bold tracking-wider">Papar:</span>
            <div className="inline-flex items-center gap-1 bg-risda-card-muted/80 p-0.5 rounded-lg border border-risda-border">
              {pageSizeOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onPageSizeChange(opt)}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                    pageSize === opt
                      ? 'bg-risda-orange text-white shadow-xs'
                      : 'text-risda-muted hover:text-risda-text hover:bg-risda-card'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          {/* First page button */}
          <button
            type="button"
            onClick={() => handlePageClick(1)}
            disabled={currentPage === 1}
            title="Halaman Pertama"
            className="p-1.5 rounded-lg border border-risda-border text-risda-text bg-risda-card hover:bg-risda-card-muted hover:border-risda-orange/60 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronsLeft size={16} />
          </button>

          {/* Prev button */}
          <button
            type="button"
            onClick={() => handlePageClick(currentPage - 1)}
            disabled={currentPage === 1}
            title="Halaman Sebelumnya"
            className="p-1.5 rounded-lg border border-risda-border text-risda-text bg-risda-card hover:bg-risda-card-muted hover:border-risda-orange/60 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft size={16} />
          </button>

          {/* Page numbers */}
          <div className="flex items-center gap-1 mx-1">
            {pages.map((p, idx) => {
              if (p === '...') {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="px-2 py-1 text-xs text-risda-muted font-bold select-none"
                  >
                    ...
                  </span>
                );
              }

              const pageNum = Number(p);
              const isActive = pageNum === currentPage;

              return (
                <button
                  key={`page-${pageNum}`}
                  type="button"
                  onClick={() => handlePageClick(pageNum)}
                  className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-black transition-all flex items-center justify-center ${
                    isActive
                      ? 'bg-risda-orange text-white shadow-md scale-105 border border-risda-orange'
                      : 'border border-risda-border bg-risda-card text-risda-text hover:bg-risda-card-muted hover:border-risda-orange/60'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          {/* Next button */}
          <button
            type="button"
            onClick={() => handlePageClick(currentPage + 1)}
            disabled={currentPage === totalPages}
            title="Halaman Seterusnya"
            className="p-1.5 rounded-lg border border-risda-border text-risda-text bg-risda-card hover:bg-risda-card-muted hover:border-risda-orange/60 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronRight size={16} />
          </button>

          {/* Last page button */}
          <button
            type="button"
            onClick={() => handlePageClick(totalPages)}
            disabled={currentPage === totalPages}
            title="Halaman Terakhir"
            className="p-1.5 rounded-lg border border-risda-border text-risda-text bg-risda-card hover:bg-risda-card-muted hover:border-risda-orange/60 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronsRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
