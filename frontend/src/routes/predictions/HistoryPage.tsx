import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Autocomplete } from '@/components/Autocomplete';
import { ListToolbar } from '@/components/ListToolbar';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { uniqueOptions } from '@/lib/autocomplete';
import { PAGE_SIZE_OPTIONS, type PageSizeOption } from '@/lib/listControls';
import { historyReliabilityLabel } from '@/lib/reliability';
import { listPredictions } from '@/services/predictions';
import { FEATURE_LABELS } from '@/types';

const FEATURE_FILTER_OPTIONS = Object.entries(FEATURE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export function PredictionsHistoryPage() {
  const [search, setSearch] = useState('');
  const [featureFilter, setFeatureFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSizeOption>(PAGE_SIZE_OPTIONS[0]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['predictions', 'history', featureFilter, statusFilter, dateFrom, dateTo, page, pageSize],
    queryFn: () =>
      listPredictions({
        featureType: featureFilter || undefined,
        status: statusFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        pageSize,
      }),
    placeholderData: keepPreviousData,
  });
  const predictions = data?.items ?? [];
  const totalItems = data?.total ?? 0;
  const totalPages = data?.total_pages ?? 0;
  const rangeStart = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalItems);

  const searchSuggestions = useMemo(
    () =>
      uniqueOptions(
        predictions.flatMap((prediction) => {
          const featureLabel = FEATURE_LABELS[prediction.feature_type] ?? prediction.feature_type;
          return [
            { value: prediction.feature_type, label: featureLabel },
            { value: prediction.model_version, label: prediction.model_version },
          ];
        }),
      ),
    [predictions],
  );

  const visible = search.trim()
    ? predictions.filter((prediction) => {
        const haystack = [
          FEATURE_LABELS[prediction.feature_type] ?? '',
          prediction.feature_type,
          prediction.model_version,
          prediction.recommendation ?? '',
          prediction.explanation ?? '',
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(search.trim().toLowerCase());
      })
    : predictions;

  const hasActiveFilters = Boolean(
    search.trim() || featureFilter || statusFilter || dateFrom || dateTo,
  );

  const resetFilters = () => {
    setSearch('');
    setFeatureFilter('');
    setStatusFilter('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  if (isLoading && !data) return <LoadingSpinner />;

  if (isError) {
    return (
      <div className="alert alert-error" role="alert">
        <p>Gagal memuat riwayat prediksi.</p>
        <button type="button" className="btn btn-secondary" onClick={() => void refetch()}>
          Coba lagi
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Riwayat Prediksi</h1>
          <p>Log lengkap semua hasil fitur AI dan analisis tersimpan</p>
        </div>
      </div>

      <div className="card table-card">
        {totalItems === 0 && !hasActiveFilters ? (
          <p className="empty-state">Belum ada prediksi tersimpan.</p>
        ) : (
          <>
            <ListToolbar
              idPrefix="predictions"
              searchValue={search}
              onSearchChange={setSearch}
              searchLabel="Cari riwayat"
              searchPlaceholder="Fitur, versi model, rekomendasi..."
              searchSuggestions={searchSuggestions}
              page={page}
              totalPages={Math.max(totalPages, 1)}
              pageSize={pageSize}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
              onPageChange={setPage}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              totalItems={totalItems}
              hasActiveFilters={hasActiveFilters}
              onResetFilters={resetFilters}
              filtersClassName="list-toolbar-filters-history"
              filters={
                <>
                  <Autocomplete
                    id="predictions-feature-filter"
                    label="Fitur"
                    value={featureFilter}
                    onChange={(value) => {
                      setFeatureFilter(value);
                      setPage(1);
                    }}
                    options={FEATURE_FILTER_OPTIONS}
                    placeholder="Ketik atau pilih fitur"
                    emptyOption={{ value: '', label: 'Semua fitur' }}
                  />
                  <Autocomplete
                    id="predictions-status-filter"
                    label="Status hasil"
                    value={statusFilter}
                    onChange={(value) => {
                      setStatusFilter(value);
                      setPage(1);
                    }}
                    options={[
                      { value: 'applicable', label: 'Hasil berlaku' },
                      { value: 'not_applicable', label: 'Tidak Berlaku' },
                    ]}
                    placeholder="Ketik atau pilih status"
                    emptyOption={{ value: '', label: 'Semua status' }}
                  />
                  <div className="history-date-filters">
                    <div className="form-group">
                      <label htmlFor="predictions-date-from">Dari tanggal</label>
                      <input
                        id="predictions-date-from"
                        type="date"
                        value={dateFrom}
                        onChange={(event) => {
                          setDateFrom(event.target.value);
                          setPage(1);
                        }}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="predictions-date-to">Sampai tanggal</label>
                      <input
                        id="predictions-date-to"
                        type="date"
                        value={dateTo}
                        onChange={(event) => {
                          setDateTo(event.target.value);
                          setPage(1);
                        }}
                      />
                    </div>
                  </div>
                </>
              }
            />
            {visible.length === 0 ? (
              <p className="empty-state">Tidak ada prediksi yang cocok dengan filter.</p>
            ) : (
              <div className="table-scroll" role="region" aria-label="Riwayat prediksi" tabIndex={0}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col" className="col-no">
                        No
                      </th>
                      <th scope="col">Fitur</th>
                      <th scope="col">Versi</th>
                      <th scope="col">Tanggal</th>
                      <th scope="col">Keandalan</th>
                      <th scope="col">Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((prediction, index) => {
                      const reliability = historyReliabilityLabel(prediction);
                      return (
                      <tr key={prediction.id}>
                        <td className="col-no" data-label="No">
                          {rangeStart + index}
                        </td>
                        <td data-label="Fitur">
                          {FEATURE_LABELS[prediction.feature_type] ?? prediction.feature_type}
                        </td>
                        <td data-label="Versi">{prediction.model_version}</td>
                        <td data-label="Tanggal">{new Date(prediction.created_at).toLocaleString('id-ID')}</td>
                        <td data-label="Keandalan">
                          {reliability.badge === 'not_applicable' ? (
                            <span className="badge">Tidak Berlaku</span>
                          ) : (
                            reliability.text
                          )}
                        </td>
                        <td data-label="Detail">
                          <Link className="table-link" to={`/predictions/${prediction.id}`}>
                            Buka detail
                          </Link>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
