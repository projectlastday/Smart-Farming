import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFarm, deleteFarm, listFarms, updateFarm } from '@/services/farms';
import type { Farm } from '@/types';
import { ConfirmDialog, RowActions, SuccessBanner } from '@/components/ConfirmDialog';
import { Autocomplete } from '@/components/Autocomplete';
import { ListToolbar } from '@/components/ListToolbar';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { usePaginatedList } from '@/hooks/usePaginatedList';
import { optionMatchesFilter, uniqueOptions } from '@/lib/autocomplete';
import { normalizeSearch } from '@/lib/listControls';
import { ApiClientError } from '@/services/api';

export function FarmsPage() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingFarm, setEditingFarm] = useState<Farm | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Farm | null>(null);
  const [search, setSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState('');

  const { data: farms = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['farms'],
    queryFn: listFarms,
    retry: 1,
  });

  const locationOptions = useMemo(
    () =>
      Array.from(new Set(farms.map((farm) => farm.location)))
        .sort((a, b) => a.localeCompare(b, 'id'))
        .map((location) => ({ value: location, label: location })),
    [farms],
  );

  const searchSuggestions = useMemo(
    () =>
      uniqueOptions(
        farms.flatMap((farm) => [
          { value: farm.name, label: farm.name },
          { value: farm.location, label: farm.location },
        ]),
      ),
    [farms],
  );

  const filteredFarms = useMemo(() => {
    const query = normalizeSearch(search);
    return farms.filter((farm) => {
      if (!optionMatchesFilter(locationFilter, farm.location, farm.location)) return false;
      if (!query) return true;
      return (
        farm.name.toLowerCase().includes(query) ||
        farm.location.toLowerCase().includes(query)
      );
    });
  }, [farms, search, locationFilter]);

  const filterResetKey = `${search}|${locationFilter}`;
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
  } = usePaginatedList(filteredFarms, filterResetKey);

  const hasActiveFilters = Boolean(search.trim() || locationFilter);

  const resetFilters = () => {
    setSearch('');
    setLocationFilter('');
  };

  const resetForm = () => {
    setName('');
    setLocation('');
    setError('');
  };

  const createMutation = useMutation({
    mutationFn: createFarm,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['farms'] });
      resetForm();
      setShowCreateForm(false);
      setSuccess('Lahan baru berhasil disimpan.');
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiClientError ? err.message : 'Gagal menyimpan lahan');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { name: string; location: string } }) =>
      updateFarm(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['farms'] });
      setEditingFarm(null);
      resetForm();
      setSuccess('Perubahan lahan berhasil disimpan.');
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiClientError ? err.message : 'Gagal memperbarui lahan');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFarm,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['farms'] });
      qc.invalidateQueries({ queryKey: ['crop-cycles'] });
      setDeleteTarget(null);
      setSuccess('Lahan berhasil dihapus.');
    },
    onError: (err: unknown) => {
      setDeleteTarget(null);
      setError(err instanceof ApiClientError ? err.message : 'Gagal menghapus lahan');
    },
  });

  const startEdit = (farm: Farm) => {
    setShowCreateForm(false);
    setEditingFarm(farm);
    setName(farm.name);
    setLocation(farm.location);
    setError('');
    setSuccess(null);
  };

  const cancelEdit = () => {
    setEditingFarm(null);
    resetForm();
  };

  const handleCreateSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSuccess(null);
    createMutation.mutate({ name, location });
  };

  const handleEditSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!editingFarm) return;
    setSuccess(null);
    updateMutation.mutate({ id: editingFarm.id, payload: { name, location } });
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (isLoading) return <LoadingSpinner />;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Kelola Lahan</h1>
          <p>Daftar lahan pertanian Anda</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setShowCreateForm((v) => !v);
            setEditingFarm(null);
            resetForm();
          }}
        >
          {showCreateForm ? 'Batal' : '+ Tambah Lahan'}
        </button>
      </div>

      <SuccessBanner message={success} />
      {error && !deleteTarget && <div className="alert alert-error">{error}</div>}

      {showCreateForm && (
        <div className="card">
          <h3>Tambah Lahan Baru</h3>
          <form onSubmit={handleCreateSubmit}>
            <div className="form-group">
              <label htmlFor="farm-name">Nama Lahan</label>
              <input id="farm-name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="farm-location">Lokasi</label>
              <input
                id="farm-location"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Contoh: Demak, Jawa Tengah"
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={createMutation.isPending}>
              Simpan
            </button>
          </form>
        </div>
      )}

      {editingFarm && (
        <div className="card">
          <h3>Ubah Lahan</h3>
          <form onSubmit={handleEditSubmit}>
            <div className="form-group">
              <label htmlFor="edit-farm-name">Nama Lahan</label>
              <input
                id="edit-farm-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="edit-farm-location">Lokasi</label>
              <input
                id="edit-farm-location"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={cancelEdit} disabled={isSaving}>
                Batal
              </button>
              <button type="submit" className="btn btn-primary" disabled={updateMutation.isPending}>
                Simpan Perubahan
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card table-card">
        {isError ? (
          <div className="alert alert-error" role="alert">
            Gagal memuat lahan.{' '}
            <button type="button" className="btn btn-secondary" onClick={() => void refetch()}>
              Coba lagi
            </button>
          </div>
        ) : farms.length === 0 ? (
          <p className="empty-state">Belum ada lahan. Tambahkan lahan pertama Anda.</p>
        ) : (
          <>
            <ListToolbar
              idPrefix="farms"
              searchValue={search}
              onSearchChange={setSearch}
              searchLabel="Cari lahan"
              searchPlaceholder="Nama atau lokasi..."
              searchSuggestions={searchSuggestions}
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
                <Autocomplete
                  id="farms-location-filter"
                  label="Filter lokasi"
                  value={locationFilter}
                  onChange={setLocationFilter}
                  options={locationOptions}
                  placeholder="Ketik atau pilih lokasi"
                  emptyOption={{ value: '', label: 'Semua lokasi' }}
                />
              }
            />
            {filteredFarms.length === 0 ? (
              <p className="empty-state">Tidak ada lahan yang cocok dengan filter.</p>
            ) : (
              <div className="table-scroll" role="region" aria-label="Daftar lahan" tabIndex={0}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col" className="col-no">
                      No
                    </th>
                    <th scope="col">Nama</th>
                    <th scope="col">Lokasi</th>
                    <th scope="col">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map((farm, index) => (
                    <tr key={farm.id}>
                      <td className="col-no" data-label="No">
                        {rowOffset + index + 1}
                      </td>
                      <td data-label="Nama">{farm.name}</td>
                      <td data-label="Lokasi">{farm.location}</td>
                      <td data-label="Aksi">
                        <RowActions>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            aria-label={`Ubah lahan ${farm.name}`}
                            onClick={() => startEdit(farm)}
                          >
                            Ubah
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            aria-label={`Hapus lahan ${farm.name}`}
                            onClick={() => {
                              setError('');
                              setSuccess(null);
                              setDeleteTarget(farm);
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
        title="Hapus lahan?"
        message={
          deleteTarget
            ? `Anda yakin ingin menghapus lahan "${deleteTarget.name}"? Tindakan ini tidak dapat dibatalkan.`
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
