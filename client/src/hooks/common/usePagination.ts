import { useState, useCallback } from "react";

interface UsePaginationProps {
  initialPage?: number;
  initialPageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

interface UsePaginationReturn {
  currentPage: number;
  pageSize: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  reset: () => void;
  offset: number;
}

export function usePagination({
  initialPage = 1,
  initialPageSize = 10,
  onPageChange,
  onPageSizeChange,
}: UsePaginationProps = {}): UsePaginationReturn {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const setPage = useCallback(
    (page: number) => {
      setCurrentPage(page);
      onPageChange?.(page);
    },
    [onPageChange]
  );

  const setPageSize = useCallback(
    (size: number) => {
      setPageSizeState(size);
      setCurrentPage(1); // Reset to first page when page size changes
      onPageSizeChange?.(size);
    },
    [onPageSizeChange]
  );

  const reset = useCallback(() => {
    setCurrentPage(initialPage);
    setPageSizeState(initialPageSize);
  }, [initialPage, initialPageSize]);

  const offset = (currentPage - 1) * pageSize;

  return {
    currentPage,
    pageSize,
    setPage,
    setPageSize,
    reset,
    offset,
  };
}

