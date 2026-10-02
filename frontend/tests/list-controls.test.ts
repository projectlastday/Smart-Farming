import { describe, expect, it } from 'vitest';
import { clampPage, normalizeSearch, paginateItems, PAGE_SIZE_ALL, PAGE_SIZE_OPTIONS, pageSizeLabel } from '@/lib/listControls';

describe('listControls', () => {
  it('normalizes search text', () => {
    expect(normalizeSearch('  Sawah  ')).toBe('sawah');
  });

  it('paginates items with correct row numbers', () => {
    const items = Array.from({ length: 12 }, (_, index) => index + 1);
    const page1 = paginateItems(items, 1, 10);
    expect(page1.paginatedItems).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(page1.rowOffset).toBe(0);
    expect(page1.rangeStart).toBe(1);
    expect(page1.rangeEnd).toBe(10);
    expect(page1.totalPages).toBe(2);

    const page2 = paginateItems(items, 2, 10);
    expect(page2.paginatedItems).toEqual([11, 12]);
    expect(page2.rowOffset).toBe(10);
    expect(page2.rangeStart).toBe(11);
    expect(page2.rangeEnd).toBe(12);
  });

  it('clamps page when page exceeds total pages', () => {
    const items = [1, 2, 3];
    const result = paginateItems(items, 5, 10);
    expect(result.safePage).toBe(1);
    expect(result.paginatedItems).toEqual([1, 2, 3]);
  });

  it('handles empty lists', () => {
    const result = paginateItems([], 1, 10);
    expect(result.paginatedItems).toEqual([]);
    expect(result.totalItems).toBe(0);
    expect(result.rangeStart).toBe(0);
    expect(result.rangeEnd).toBe(0);
    expect(clampPage(3, 1)).toBe(1);
  });

  it('exposes expected page size options including Semua', () => {
    expect(PAGE_SIZE_OPTIONS).toEqual([10, 25, 50, 100, 200, PAGE_SIZE_ALL]);
    expect(pageSizeLabel(PAGE_SIZE_ALL)).toBe('Semua');
    expect(pageSizeLabel(25)).toBe('25');
  });

  it('Semua page size returns every item on a single page', () => {
    const items = Array.from({ length: 12 }, (_, index) => index + 1);
    const result = paginateItems(items, 1, PAGE_SIZE_ALL);
    expect(result.paginatedItems).toEqual(items);
    expect(result.totalPages).toBe(1);
    expect(result.rangeStart).toBe(1);
    expect(result.rangeEnd).toBe(12);
  });
});
