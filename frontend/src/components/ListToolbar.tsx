import type { ReactNode } from 'react';
import { Autocomplete } from '@/components/Autocomplete';
import type { AutocompleteOption } from '@/lib/autocomplete';
import { PAGE_SIZE_OPTIONS, pageSizeLabel, type PageSizeOption } from '@/lib/listControls';

type ListToolbarProps = {
  idPrefix: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchLabel?: string;
  searchPlaceholder?: string;
  searchSuggestions?: AutocompleteOption[];
  filters?: ReactNode;
  filtersClassName?: string;
  page: number;
  totalPages: number;
  pageSize: number;
  onPageSizeChange: (size: PageSizeOption) => void;
  onPageChange: (page: number) => void;
  rangeStart: number;
  rangeEnd: number;
  totalItems: number;
  onResetFilters?: () => void;
  hasActiveFilters?: boolean;
  showSearch?: boolean;
  pageSizeOptions?: readonly PageSizeOption[];
};

export function ListToolbar({
  idPrefix,
  searchValue = '',
  onSearchChange = () => undefined,
  searchLabel = 'Cari',
  searchPlaceholder = 'Ketik kata kunci...',
  searchSuggestions = [],
  filters,
  filtersClassName,
  page,
  totalPages,
  pageSize,
  onPageSizeChange,
  onPageChange,
  rangeStart,
  rangeEnd,
  totalItems,
  onResetFilters,
  hasActiveFilters = false,
  showSearch = true,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
}: ListToolbarProps) {
  const summary =
    totalItems === 0
      ? 'Tidak ada data'
      : `Menampilkan ${rangeStart}–${rangeEnd} dari ${totalItems}`;

  return (
    <div className="list-toolbar" role="region" aria-label="Filter dan paginasi">
      <div className={['list-toolbar-filters', filtersClassName].filter(Boolean).join(' ')}>
        {showSearch && (
          <Autocomplete
            id={`${idPrefix}-search`}
            label={searchLabel}
            value={searchValue}
            onChange={onSearchChange}
            options={searchSuggestions}
            placeholder={searchPlaceholder}
            allowCustom
            noMatchLabel="Tidak ada saran yang cocok"
          />
        )}
        {filters}
        {hasActiveFilters && onResetFilters && (
          <div className="form-group list-toolbar-reset">
            <span className="visually-hidden" id={`${idPrefix}-reset-label`}>
              Atur ulang filter
            </span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onResetFilters}>
              Atur ulang filter
            </button>
          </div>
        )}
      </div>

      <div className="list-toolbar-footer">
        <div className="list-toolbar-status">
          <p className="list-summary" aria-live="polite">
            {summary}
          </p>
          <div className="form-group list-toolbar-page-size">
            <label htmlFor={`${idPrefix}-page-size`}>Baris per halaman</label>
            <select
              id={`${idPrefix}-page-size`}
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value) as PageSizeOption)}
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {pageSizeLabel(size)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <nav className="pagination" aria-label="Paginasi">
          <button
            type="button"
            className="btn btn-secondary btn-sm pagination-prev"
            disabled={page <= 1}
            aria-label="Halaman sebelumnya"
            onClick={() => onPageChange(page - 1)}
          >
            Sebelumnya
          </button>
          <span className="pagination-status" aria-current="page">
            Halaman {page} dari {totalPages}
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm pagination-next"
            disabled={page >= totalPages}
            aria-label="Halaman berikutnya"
            onClick={() => onPageChange(page + 1)}
          >
            Berikutnya
          </button>
        </nav>
      </div>
    </div>
  );
}
