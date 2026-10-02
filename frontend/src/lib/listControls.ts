export const PAGE_SIZE_ALL = 0;

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200, PAGE_SIZE_ALL] as const;

export type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];

export const DEFAULT_PAGE_SIZE: PageSizeOption = 10;

export function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

export function clampPage(page: number, totalPages: number): number {
  const safeTotal = Math.max(1, totalPages);
  return Math.min(Math.max(1, page), safeTotal);
}

export function effectivePageSize(pageSize: number, totalItems: number): number {
  if (pageSize <= 0) {
    return Math.max(totalItems, 1);
  }
  return pageSize;
}

export function paginateItems<T>(items: T[], page: number, pageSize: number) {
  const totalItems = items.length;
  const size = effectivePageSize(pageSize, totalItems);
  const totalPages = totalItems === 0 ? 1 : Math.ceil(totalItems / size);
  const safePage = clampPage(page, totalPages);
  const rowOffset = (safePage - 1) * size;
  const paginatedItems = items.slice(rowOffset, rowOffset + size);

  return {
    paginatedItems,
    totalItems,
    totalPages,
    safePage,
    rowOffset,
    rangeStart: totalItems === 0 ? 0 : rowOffset + 1,
    rangeEnd: totalItems === 0 ? 0 : Math.min(rowOffset + size, totalItems),
  };
}

export function pageSizeLabel(size: number): string {
  return size === PAGE_SIZE_ALL ? 'Semua' : String(size);
}
