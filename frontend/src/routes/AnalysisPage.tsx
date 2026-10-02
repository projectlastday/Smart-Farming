import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Autocomplete } from '@/components/Autocomplete';
import { cycleOptionLabel } from '@/components/CropCycleSelect';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ListToolbar } from '@/components/ListToolbar';
import { PAGE_SIZE_OPTIONS, type PageSizeOption } from '@/lib/listControls';
import { historyReliabilityLabel } from '@/lib/reliability';
import { listCropCycles, listFarms } from '@/services/farms';
import { listPredictions } from '@/services/predictions';
import { FEATURE_LABELS } from '@/types';

const FEATURE_FILTER_OPTIONS = Object.entries(FEATURE_LABELS).map(([value, label]) => ({
  value,
  label,
}));
const ANALYSIS_PAGE_SIZE_OPTIONS = PAGE_SIZE_OPTIONS.filter((size) => size > 0 && size <= 100);

export function AnalysisPage() {
  const [farmFilter, setFarmFilter] = useState('');
  const [cycleFilter, setCycleFilter] = useState('');
  const [featureFilter, setFeatureFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSizeOption>(100);
  const farmsQuery = useQuery({ queryKey: ['farms'], queryFn: listFarms });
  const cyclesQuery = useQuery({ queryKey: ['crop-cycles'], queryFn: listCropCycles });
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [
      'predictions',
      'analysis',
      farmFilter,
      cycleFilter,
      featureFilter,
      statusFilter,
      dateFrom,
      dateTo,
      page,
      pageSize,
    ],
    queryFn: () =>
      listPredictions({
        farmId: farmFilter || undefined,
        cropCycleId: cycleFilter || undefined,
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

  const hasActiveFilters = Boolean(
    farmFilter || cycleFilter || featureFilter || statusFilter || dateFrom || dateTo,
  );

  const resetFilters = () => {
    setFarmFilter('');
    setCycleFilter('');
    setFeatureFilter('');
    setStatusFilter('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const farms = farmsQuery.data ?? [];
  const cycles = cyclesQuery.data ?? [];
  const farmOptions = useMemo(
    () =>
      farms
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, 'id'))
        .map((farm) => ({ value: farm.id, label: farm.name, description: farm.location })),
    [farms],
  );
  const cycleOptions = useMemo(
    () =>
      cycles
        .filter((cycle) => !farmFilter || cycle.farm_id === farmFilter)
        .map((cycle) => ({
          value: cycle.id,
          label: cycleOptionLabel(cycle),
          description: cycle.location,
        })),
    [cycles, farmFilter],
  );

  const handleFarmChange = (value: string) => {
    setFarmFilter(value);
    if (cycleFilter && cycles.find((cycle) => cycle.id === cycleFilter)?.farm_id !== value) {
      setCycleFilter('');
    }
    setPage(1);
  };

  if (isLoading && !data) return <LoadingSpinner />;

  if (isError) {
    return (
      <div className="alert alert-error" role="alert">
        <p>Gagal memuat daftar prediksi.</p>
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
          <h1>Analisis Tanaman</h1>
          <p>Semua prediksi tersimpan dari lahan dan siklus tanam Anda</p>
        </div>
      </div>

      <section className="card table-card" aria-labelledby="analysis-list-title">
        <div className="section-heading">
          <div>
            <h2 id="analysis-list-title">Daftar prediksi</h2>
            <p className="harvest-meta">
              {totalItems > 0 ? `Menampilkan ${rangeStart}–${rangeEnd} dari ${totalItems} prediksi` : null}
            </p>
          </div>
        </div>

        <ListToolbar
          idPrefix="analysis"
          showSearch={false}
          page={page}
          totalPages={Math.max(totalPages, 1)}
          pageSize={pageSize}
          pageSizeOptions={ANALYSIS_PAGE_SIZE_OPTIONS}
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
                id="analysis-farm-filter"
                label="Lahan"
                value={farmFilter}
                onChange={handleFarmChange}
                options={farmOptions}
                placeholder="Ketik atau pilih lahan"
                emptyOption={{ value: '', label: 'Semua lahan' }}
              />
              <Autocomplete
                id="analysis-cycle-filter"
                label="Siklus Tanam"
                value={cycleFilter}
                onChange={(value) => {
                  setCycleFilter(value);
                  setPage(1);
                }}
                options={cycleOptions}
                placeholder="Ketik atau pilih siklus"
                emptyOption={{ value: '', label: 'Semua siklus' }}
              />
              <Autocomplete
                id="analysis-feature-filter"
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
                id="analysis-status-filter"
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
                  <label htmlFor="analysis-date-from">Dari tanggal</label>
                  <input
                    id="analysis-date-from"
                    type="date"
                    value={dateFrom}
                    onChange={(event) => {
                      setDateFrom(event.target.value);
                      setPage(1);
                    }}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="analysis-date-to">Sampai tanggal</label>
                  <input
                    id="analysis-date-to"
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

        {predictions.length === 0 ? (
          <p className="empty-state">
            {hasActiveFilters ? 'Tidak ada prediksi yang cocok dengan filter.' : 'Belum ada prediksi tersimpan.'}
          </p>
        ) : (
          <>
            <div className="table-scroll" role="region" aria-label="Daftar semua prediksi" tabIndex={0}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col" className="col-no">No</th>
                    <th scope="col">Jenis analisis</th>
                    <th scope="col">Versi</th>
                    <th scope="col">Tanggal</th>
                    <th scope="col">Keandalan</th>
                    <th scope="col">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {predictions.map((prediction, index) => {
                    const reliability = historyReliabilityLabel(prediction);
                    return (
                      <tr key={prediction.id}>
                        <td className="col-no" data-label="No">{rangeStart + index}</td>
                        <td data-label="Jenis analisis">
                          {FEATURE_LABELS[prediction.feature_type] ?? prediction.feature_type}
                        </td>
                        <td data-label="Versi">{prediction.model_version}</td>
                        <td data-label="Tanggal">
                          {new Date(prediction.created_at).toLocaleString('id-ID')}
                        </td>
                        <td data-label="Keandalan">
                          {reliability.badge === 'not_applicable' ? (
                            <span className="badge">Tidak Berlaku</span>
                          ) : (
                            reliability.text
                          )}
                        </td>
                        <td data-label="Aksi">
                          <Link className="btn btn-primary" to={`/predictions/${prediction.id}`}>
                            Buka
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          </>
        )}
      </section>
    </>
  );
}
