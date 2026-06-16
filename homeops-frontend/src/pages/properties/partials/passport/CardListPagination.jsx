import React, {useEffect, useMemo, useState} from "react";
import {ChevronLeft, ChevronRight} from "lucide-react";

const DEFAULT_PAGE_SIZE_OPTIONS = [5, 10, 20];

export function usePaginatedList(items = [], initialPageSize = 5) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, pageCount);

  useEffect(() => {
    setPage(1);
  }, [items.length, pageSize]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const pageItems = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize],
  );

  return {
    pageItems,
    page: safePage,
    setPage,
    pageSize,
    setPageSize,
    totalItems: items.length,
    pageCount,
    rangeStart: items.length === 0 ? 0 : (safePage - 1) * pageSize + 1,
    rangeEnd: Math.min(safePage * pageSize, items.length),
  };
}

function CardListPagination({
  totalItems,
  page,
  pageSize,
  pageCount,
  rangeStart,
  rangeEnd,
  onPageChange,
  onPageSizeChange,
  itemLabel = "item",
  itemLabelPlural,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
}) {
  if (totalItems === 0) return null;

  const plural = itemLabelPlural || `${itemLabel}s`;
  const label = totalItems === 1 ? itemLabel : plural;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-1 border-t border-neutral-100 dark:border-neutral-800">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Showing {rangeStart} to {rangeEnd} of {totalItems} {label}
      </p>
      <div className="flex items-center gap-2">
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="form-select text-xs bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 rounded-lg pl-2 pr-6 py-1"
          aria-label={`${label} per page`}
        >
          {pageSizeOptions.map((n) => (
            <option key={n} value={n}>
              {n} / page
            </option>
          ))}
        </select>
        {pageCount > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-md text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:pointer-events-none"
              title="Previous page"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="min-w-[2rem] text-center text-xs font-medium text-neutral-700 dark:text-neutral-300 px-1">
              {page}
            </span>
            <button
              type="button"
              onClick={() => onPageChange(Math.min(pageCount, page + 1))}
              disabled={page >= pageCount}
              className="p-1.5 rounded-md text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:pointer-events-none"
              title="Next page"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default CardListPagination;
