import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FarmsPage } from '@/routes/FarmsPage';
import * as farmsService from '@/services/farms';

vi.mock('@/services/farms');

const manyFarms = Array.from({ length: 12 }, (_, index) => ({
  id: `farm-${index + 1}`,
  name: `Sawah ${index + 1}`,
  location: index % 2 === 0 ? 'Demak' : 'Kudus',
  farmer_id: 'farmer-1',
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <FarmsPage />
    </QueryClientProvider>,
  );
}

describe('FarmsPage list controls', () => {
  beforeEach(() => {
    vi.mocked(farmsService.listFarms).mockResolvedValue(manyFarms);
    vi.mocked(farmsService.createFarm).mockResolvedValue(manyFarms[0]);
    vi.mocked(farmsService.updateFarm).mockResolvedValue(manyFarms[0]);
    vi.mocked(farmsService.deleteFarm).mockResolvedValue({ message: 'Lahan berhasil dihapus' });
  });

  it('shows numbered rows and paginates by page size', async () => {
    renderPage();
    expect(await screen.findByRole('columnheader', { name: 'No' })).toBeInTheDocument();

    const firstPageRows = screen.getAllByRole('row').slice(1);
    expect(within(firstPageRows[0]).getByRole('cell', { name: '1' })).toBeInTheDocument();
    expect(within(firstPageRows[9]).getByRole('cell', { name: '10' })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'Sawah 11' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Halaman berikutnya' }));
    expect(await screen.findByRole('cell', { name: '11' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Sawah 11' })).toBeInTheDocument();
  });

  it('filters by search and resets to page one', async () => {
    renderPage();
    await screen.findByRole('cell', { name: 'Sawah 1' });

    fireEvent.click(screen.getByRole('button', { name: 'Halaman berikutnya' }));
    expect(await screen.findByText('Halaman 2 dari 2')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Cari lahan'), { target: { value: 'Sawah 2' } });
    expect(await screen.findByText('Halaman 1 dari 1')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Sawah 2' })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'Sawah 11' })).not.toBeInTheDocument();
  });

  it('shows empty filter state and keeps CRUD controls on matches', async () => {
    renderPage();
    await screen.findByRole('cell', { name: 'Sawah 1' });

    fireEvent.change(screen.getByLabelText('Filter lokasi'), { target: { value: 'Kudus' } });
    fireEvent.change(screen.getByLabelText('Cari lahan'), { target: { value: 'zzz-tidak-ada' } });
    expect(await screen.findByText('Tidak ada lahan yang cocok dengan filter.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Atur ulang filter' }));
    fireEvent.change(screen.getByLabelText('Cari lahan'), { target: { value: 'Sawah 2' } });
    expect(await screen.findByRole('button', { name: 'Ubah lahan Sawah 2' })).toBeInTheDocument();
  });

  it('filters lokasi with autocomplete suggestions', async () => {
    renderPage();
    await screen.findByRole('cell', { name: 'Sawah 1' });

    const locationFilter = screen.getByRole('combobox', { name: 'Filter lokasi' });
    fireEvent.focus(locationFilter);
    fireEvent.change(locationFilter, { target: { value: 'kud' } });
    expect(screen.getByRole('option', { name: 'Kudus' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Demak' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: 'Kudus' }));

    expect(await screen.findByRole('cell', { name: 'Sawah 2' })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'Sawah 1' })).not.toBeInTheDocument();
  });

  it('changes page size and recalculates numbering', async () => {
    renderPage();
    await screen.findByRole('cell', { name: 'Sawah 1' });

    fireEvent.change(screen.getByLabelText('Baris per halaman'), { target: { value: '25' } });
    expect(await screen.findByText('Halaman 1 dari 1')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Sawah 12' })).toBeInTheDocument();
    expect(within(screen.getAllByRole('row')[12]).getByRole('cell', { name: '12' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Baris per halaman'), { target: { value: '0' } });
    expect(screen.getByRole('option', { name: 'Semua' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '100' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '200' })).toBeInTheDocument();
    expect(await screen.findByText('Menampilkan 1–12 dari 12')).toBeInTheDocument();
  });
});
