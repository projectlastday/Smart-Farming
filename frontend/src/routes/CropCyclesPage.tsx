import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createCropCycle,
  deleteCropCycle,
  listCropCycles,
  listFarms,
  updateCropCycle,
} from '@/services/farms';
import { cropDisplayLabel } from '@/lib/crops';
import { lifecycleDisplayLabel } from '@/lib/display';
import type { CropCycle } from '@/types';
import { CROP_OPTIONS, LIFECYCLE_OPTIONS, VARIETY_OPTIONS } from '@/types';
import { ConfirmDialog, RowActions, SuccessBanner } from '@/components/ConfirmDialog';
import { Autocomplete } from '@/components/Autocomplete';
import { ListToolbar } from '@/components/ListToolbar';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { usePaginatedList } from '@/hooks/usePaginatedList';
import { type AutocompleteOption } from '@/lib/autocomplete';
import { cycleMatchesListFilters, uniqueCycleFieldOptions } from '@/lib/cropCycleFilters';
import { ApiClientError } from '@/services/api';

function cycleLabel(cycle: CropCycle) {
  return `${cropDisplayLabel(cycle.crop)} / ${cycle.variety} — ${cycle.planting_date}`;
}

function varietyForForm(cycle: CropCycle): string {
  const normalized = cycle.variety.toLowerCase();
  if (cycle.crop === 'rice') {
    if (normalized.includes('ir64')) return 'ir64';
    if (normalized.includes('inpari')) return 'inpari32';
    return 'ciherang';
  }
  return 'Jambu Standar';
}

export function CropCyclesPage() {
  const qc = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<string | null>(null);
  const [farmId, setFarmId] = useState('');
  const [crop, setCrop] = useState('rice');
  const [variety, setVariety] = useState('ciherang');
  const [plantingDate, setPlantingDate] = useState('');
  const [area, setArea] = useState('');
  const [location, setLocation] = useState('');
  const [lifecycle, setLifecycle] = useState('growing');
  const [editingCycle, setEditingCycle] = useState<CropCycle | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CropCycle | null>(null);
  const [farmFilter, setFarmFilter] = useState('');
  const [cropFilter, setCropFilter] = useState('');
  const [varietyFilter, setVarietyFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const farmsQuery = useQuery({ queryKey: ['farms'], queryFn: listFarms });
  const cyclesQuery = useQuery({ queryKey: ['crop-cycles'], queryFn: listCropCycles });

  const cycles = cyclesQuery.data ?? [];
  const farms = farmsQuery.data ?? [];

  const farmOptions = useMemo<AutocompleteOption[]>(
    () =>
      farms
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, 'id'))
        .map((farm) => ({
          value: farm.id,
          label: farm.name,
          description: farm.location,
        })),
    [farms],
  );

  const varietyOptions = useMemo(() => uniqueCycleFieldOptions(cycles, 'variety'), [cycles]);
  const locationOptions = useMemo(() => uniqueCycleFieldOptions(cycles, 'location'), [cycles]);

  const filteredCycles = useMemo(
    () =>
      cycles.filter((cycle) =>
        cycleMatchesListFilters(cycle, farms, {
          farmFilter,
          cropFilter,
          varietyFilter,
          locationFilter,
          statusFilter,
        }),
      ),
    [cycles, farms, farmFilter, cropFilter, varietyFilter, locationFilter, statusFilter],
  );

  const filterResetKey = `${farmFilter}|${cropFilter}|${varietyFilter}|${locationFilter}|${statusFilter}`;
  const {
    paginatedItems,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    rowOffset,
    rangeStart,
    rangeEnd,
    totalItems,
  } = usePaginatedList(filteredCycles, filterResetKey);

  const hasActiveFilters = Boolean(farmFilter || cropFilter || varietyFilter || locationFilter || statusFilter);

  const resetFilters = () => {
    setFarmFilter('');
    setCropFilter('');
    setVarietyFilter('');
    setLocationFilter('');
    setStatusFilter('');
  };

  useEffect(() => {
    if (crop !== 'rice' && !['Jambu Standar', 'jambu_standart', 'Kristal', 'Jambu Kristal'].includes(variety)) {
      setVariety('Jambu Standar');
    }
    if (crop === 'rice' && (variety === 'Jambu Standar' || variety === 'jambu_standart')) {
      setVariety('ciherang');
    }
  }, [crop, variety]);

  const resetForm = () => {
    setFarmId('');
    setCrop('rice');
    setVariety('ciherang');
    setPlantingDate('');
    setArea('');
    setLocation('');
    setLifecycle('growing');
    setError('');
  };

  const buildPayload = () => ({
    farm_id: farmId,
    crop,
    variety,
    planting_date: plantingDate,
    area: parseFloat(area),
    location,
    lifecycle_status: lifecycle,
  });

  const createMutation = useMutation({
    mutationFn: () => createCropCycle(farmId, buildPayload()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crop-cycles'] });
      setShowCreateForm(false);
      resetForm();
      setSuccess('Siklus tanam baru berhasil disimpan.');
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiClientError ? err.message : 'Gagal menyimpan siklus');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ReturnType<typeof buildPayload> }) =>
      updateCropCycle(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crop-cycles'] });
      setEditingCycle(null);
      resetForm();
      setSuccess('Perubahan siklus tanam berhasil disimpan.');
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiClientError ? err.message : 'Gagal memperbarui siklus');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCropCycle,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crop-cycles'] });
      setDeleteTarget(null);
      setSuccess('Siklus tanam berhasil dihapus.');
    },
    onError: (err: unknown) => {
      setDeleteTarget(null);
      setError(err instanceof ApiClientError ? err.message : 'Gagal menghapus siklus');
    },
  });

  const startEdit = (cycle: CropCycle) => {
    setShowCreateForm(false);
    setEditingCycle(cycle);
    setFarmId(cycle.farm_id);
    setCrop(cycle.crop);
    setVariety(varietyForForm(cycle));
    setPlantingDate(cycle.planting_date);
    setArea(String(cycle.area));
    setLocation(cycle.location);
    setLifecycle(cycle.lifecycle_status);
    setError('');
    setSuccess(null);
  };

  const cancelEdit = () => {
    setEditingCycle(null);
    resetForm();
  };

  const renderCycleForm = (mode: 'create' | 'edit', onSubmit: (e: FormEvent) => void, pending: boolean) => (
    <form onSubmit={onSubmit}>
        <Autocomplete
          id={mode === 'create' ? 'cycle-farm' : 'edit-cycle-farm'}
          label="Lahan"
          value={farmId}
          onChange={setFarmId}
          options={farmOptions}
          placeholder="Cari nama atau lokasi lahan"
          emptyOption={{ value: '', label: '— Pilih lahan —' }}
          required
        />
      <div className="form-row">
        <div className="form-group">
          <label htmlFor={mode === 'create' ? 'cycle-crop' : 'edit-cycle-crop'}>Tanaman</label>
          <select
            id={mode === 'create' ? 'cycle-crop' : 'edit-cycle-crop'}
            value={crop}
            onChange={(e) => setCrop(e.target.value)}
          >
            {CROP_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor={mode === 'create' ? 'cycle-variety' : 'edit-cycle-variety'}>Varietas</label>
          <select
            id={mode === 'create' ? 'cycle-variety' : 'edit-cycle-variety'}
            value={variety}
            onChange={(e) => setVariety(e.target.value)}
          >
            {crop === 'rice'
              ? VARIETY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))
              : <option value="Jambu Standar">Jambu Standar</option>}
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor={mode === 'create' ? 'cycle-date' : 'edit-cycle-date'}>Tanggal Tanam</label>
          <input
            id={mode === 'create' ? 'cycle-date' : 'edit-cycle-date'}
            type="date"
            required
            value={plantingDate}
            onChange={(e) => setPlantingDate(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor={mode === 'create' ? 'cycle-area' : 'edit-cycle-area'}>Luas (ha)</label>
          <input
            id={mode === 'create' ? 'cycle-area' : 'edit-cycle-area'}
            type="number"
            step="0.01"
            min="0.01"
            required
            value={area}
            onChange={(e) => setArea(e.target.value)}
          />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor={mode === 'create' ? 'cycle-location' : 'edit-cycle-location'}>Lokasi Spesifik</label>
          <input
            id={mode === 'create' ? 'cycle-location' : 'edit-cycle-location'}
            required
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor={mode === 'create' ? 'cycle-status' : 'edit-cycle-status'}>Status</label>
          <select
            id={mode === 'create' ? 'cycle-status' : 'edit-cycle-status'}
            value={lifecycle}
            onChange={(e) => setLifecycle(e.target.value)}
          >
            {LIFECYCLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {mode === 'edit' ? (
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={cancelEdit} disabled={pending}>
            Batal
          </button>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            Simpan Perubahan
          </button>
        </div>
      ) : (
        <button type="submit" className="btn btn-primary" disabled={pending}>
          Simpan Siklus
        </button>
      )}
    </form>
  );

  if (farmsQuery.isLoading || cyclesQuery.isLoading) return <LoadingSpinner />;

  if (farmsQuery.isError || cyclesQuery.isError) {
    return (
      <div className="alert alert-error" role="alert">
        <p>Gagal memuat siklus tanam.</p>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            void farmsQuery.refetch();
            void cyclesQuery.refetch();
          }}
        >
          Coba lagi
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Siklus Tanam</h1>
          <p>Kelola siklus tanam padi dan jambu biji</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setShowCreateForm((v) => !v);
            setEditingCycle(null);
            resetForm();
          }}
        >
          {showCreateForm ? 'Batal' : '+ Tambah Siklus'}
        </button>
      </div>

      <SuccessBanner message={success} />
      {error && !deleteTarget && <div className="alert alert-error">{error}</div>}

      {showCreateForm && (
        <div className="card">
          <h3>Tambah Siklus Tanam</h3>
          {renderCycleForm('create', (e) => {
            e.preventDefault();
            setSuccess(null);
            createMutation.mutate();
          }, createMutation.isPending)}
        </div>
      )}

      {editingCycle && (
        <div className="card">
          <h3>Ubah Siklus Tanam</h3>
          {renderCycleForm('edit', (e) => {
            e.preventDefault();
            if (!editingCycle) return;
            setSuccess(null);
            updateMutation.mutate({ id: editingCycle.id, payload: buildPayload() });
          }, updateMutation.isPending)}
        </div>
      )}

      <div className="card table-card">
        {cycles.length === 0 ? (
          <p className="empty-state">Belum ada siklus tanam.</p>
        ) : (
          <>
            <ListToolbar
              idPrefix="cycles"
              searchValue=""
              onSearchChange={() => undefined}
              showSearch={false}
              filtersClassName="list-toolbar-filters-cycles"
              page={page}
              totalPages={totalPages}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              onPageChange={setPage}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              totalItems={totalItems}
              hasActiveFilters={hasActiveFilters}
              onResetFilters={resetFilters}
              filters={
                <>
                  <Autocomplete
                    id="cycles-farm-filter"
                    label="Lahan"
                    value={farmFilter}
                    onChange={setFarmFilter}
                    options={farmOptions}
                    placeholder="Cari nama lahan"
                    emptyOption={{ value: '', label: 'Semua lahan' }}
                    maxResults={100}
                  />
                  <Autocomplete
                    id="cycles-crop-filter"
                    label="Tanaman"
                    value={cropFilter}
                    onChange={setCropFilter}
                    options={CROP_OPTIONS}
                    placeholder="Pilih tanaman"
                    emptyOption={{ value: '', label: 'Semua tanaman' }}
                  />
                  <Autocomplete
                    id="cycles-variety-filter"
                    label="Varietas"
                    value={varietyFilter}
                    onChange={setVarietyFilter}
                    options={varietyOptions}
                    placeholder="Cari varietas"
                    emptyOption={{ value: '', label: 'Semua varietas' }}
                    maxResults={100}
                  />
                  <Autocomplete
                    id="cycles-location-filter"
                    label="Lokasi"
                    value={locationFilter}
                    onChange={setLocationFilter}
                    options={locationOptions}
                    placeholder="Cari lokasi siklus"
                    emptyOption={{ value: '', label: 'Semua lokasi' }}
                    maxResults={100}
                  />
                  <Autocomplete
                    id="cycles-status-filter"
                    label="Status siklus"
                    value={statusFilter}
                    onChange={setStatusFilter}
                    options={LIFECYCLE_OPTIONS}
                    placeholder="Pilih status"
                    emptyOption={{ value: '', label: 'Semua status' }}
                  />
                </>
              }
            />
            {filteredCycles.length === 0 ? (
              <p className="empty-state">Tidak ada siklus tanam yang cocok dengan filter.</p>
            ) : (
              <div className="table-scroll" role="region" aria-label="Daftar siklus tanam" tabIndex={0}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col" className="col-no">
                      No
                    </th>
                    <th scope="col">Tanaman</th>
                    <th scope="col">Varietas</th>
                    <th scope="col">Tanam</th>
                    <th scope="col">Luas</th>
                    <th scope="col">Status</th>
                    <th scope="col">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map((cycle, index) => (
                    <tr key={cycle.id}>
                      <td className="col-no" data-label="No">
                        {rowOffset + index + 1}
                      </td>
                      <td data-label="Tanaman">{cropDisplayLabel(cycle.crop)}</td>
                      <td data-label="Varietas">{cycle.variety}</td>
                      <td data-label="Tanam">{cycle.planting_date}</td>
                      <td data-label="Luas">{Number(cycle.area).toFixed(2)} ha</td>
                      <td data-label="Status">
                        <span className="badge">{lifecycleDisplayLabel(cycle.lifecycle_status)}</span>
                      </td>
                      <td data-label="Aksi">
                        <RowActions>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            aria-label={`Ubah siklus ${cycleLabel(cycle)}`}
                            onClick={() => startEdit(cycle)}
                          >
                            Ubah
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            aria-label={`Hapus siklus ${cycleLabel(cycle)}`}
                            onClick={() => {
                              setError('');
                              setSuccess(null);
                              setDeleteTarget(cycle);
                            }}
                          >
                            Hapus
                          </button>
                        </RowActions>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus siklus tanam?"
        message={
          deleteTarget
            ? `Anda yakin ingin menghapus siklus ${cycleLabel(deleteTarget)}? Tindakan ini tidak dapat dibatalkan.`
            : ''
        }
        confirmLabel="Ya, Hapus"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
        isPending={deleteMutation.isPending}
      />
    </>
  );
}
