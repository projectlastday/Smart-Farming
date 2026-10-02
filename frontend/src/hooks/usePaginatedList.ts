import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_PAGE_SIZE, paginateItems, type PageSizeOption } from '@/lib/listControls';

export function usePaginatedList<T>(filteredItems: T[], resetKey = '') {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSizeOption>(DEFAULT_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [resetKey, pageSize]);

  const pagination = useMemo(
    () => paginateItems(filteredItems, page, pageSize),
    [filteredItems, page, pageSize],
  );

  useEffect(() => {
    if (pagination.safePage !== page) {
      setPage(pagination.safePage);
    }
  }, [pagination.safePage, page]);

  const setPageSizeAndReset = (size: PageSizeOption) => {
    setPageSize(size);
    setPage(1);
  };

  return {
    page,
    setPage,
    pageSize,
    setPageSize: setPageSizeAndReset,
    paginatedItems: pagination.paginatedItems,
    totalItems: pagination.totalItems,
    totalPages: pagination.totalPages,
    rowOffset: pagination.rowOffset,
    rangeStart: pagination.rangeStart,
    rangeEnd: pagination.rangeEnd,
  };
}
