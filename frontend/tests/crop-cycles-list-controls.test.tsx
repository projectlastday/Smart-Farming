import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CropCyclesPage } from '@/routes/CropCyclesPage';
import * as farmsService from '@/services/farms';

vi.mock('@/services/farms');

const sampleFarms = [
  {
    id: 'farm-1',
    name: 'Sawah Demo',
    location: 'Demak',
    farmer_id: 'farmer-1',
  },
  {
    id: 'farm-2',
    name: 'Kebun Jambu',
    location: 'Kudus',
    farmer_id: 'farmer-1',
  },
];

const manyCycles = [
  ...Array.from({ length: 11 }, (_, index) => ({
    id: `cycle-rice-${index + 1}`,
    farm_id: 'farm-1',
    crop: 'rice',
    variety: 'Ciherang',
    planting_date: `2026-03-${String(index + 1).padStart(2, '0')}`,
    area: 1 + index * 0.1,
    location: `Blok ${index + 1}`,
    lifecycle_status: 'growing',
  })),
  {
    id: 'cycle-guava-1',
    farm_id: 'farm-2',
    crop: 'guava',
    variety: 'Kristal',
    planting_date: '2010-01-01',
    area: 2,
    location: 'Kebun Jambu',
    lifecycle_status: 'growing',
  },
];

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CropCyclesPage />
    </QueryClientProvider>,
  );
}

describe('CropCyclesPage list controls', () => {
  beforeEach(() => {
    vi.mocked(farmsService.listFarms).mockResolvedValue(sampleFarms);
    vi.mocked(farmsService.listCropCycles).mockResolvedValue(manyCycles);
    vi.mocked(farmsService.updateCropCycle).mockResolvedValue(manyCycles[0]);
    vi.mocked(farmsService.deleteCropCycle).mockResolvedValue({ message: 'Siklus tanam berhasil dihapus' });
  });

  it('paginates cycles with No column', async () => {
    renderPage();
    expect(await screen.findByRole('columnheader', { name: 'No' })).toBeInTheDocument();
    expect(within(screen.getAllByRole('row')[1]).getByRole('cell', { name: '1' })).toBeInTheDocument();
    expect(screen.getByText('Halaman 1 dari 2')).toBeInTheDocument();
    expect(screen.queryByText('Kristal')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Halaman berikutnya' }));
    expect(await screen.findByText('Kristal')).toBeInTheDocument();
    expect(within(screen.getAllByRole('row')[1]).getByRole('cell', { name: '11' })).toBeInTheDocument();
  });

  it('exposes separate lahan, tanaman, varietas, lokasi, and status filters', async () => {
    renderPage();
    await screen.findByText('Halaman 1 dari 2');
    expect(screen.queryByLabelText('Cari siklus')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Lahan' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Tanaman' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Varietas' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Lokasi' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Status siklus' })).toBeInTheDocument();
    expect(document.querySelector('.list-toolbar-filters-cycles')).toBeTruthy();
  });

  it('filters by varietas and lokasi', async () => {
    renderPage();
    await screen.findByText('Halaman 1 dari 2');

    const variety = screen.getByRole('combobox', { name: 'Varietas' });
    fireEvent.focus(variety);
    fireEvent.change(variety, { target: { value: 'Kristal' } });
    fireEvent.click(screen.getByRole('option', { name: 'Kristal' }));
    expect(await screen.findByText('Kristal')).toBeInTheDocument();
    expect(screen.queryByText('Blok 1')).not.toBeInTheDocument();
    expect(screen.getByText('Halaman 1 dari 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Atur ulang filter' }));
    await screen.findByText('Halaman 1 dari 2');

    const location = screen.getByRole('combobox', { name: 'Lokasi' });
    fireEvent.focus(location);
    fireEvent.change(location, { target: { value: 'Blok 2' } });
    fireEvent.click(screen.getByRole('option', { name: 'Blok 2' }));
    expect(await screen.findByRole('cell', { name: '2026-03-02' })).toBeInTheDocument();
    expect(screen.queryByText('Kristal')).not.toBeInTheDocument();
  });

  it('combines crop and status filters and resets pagination', async () => {
    renderPage();
    await screen.findByText('Halaman 1 dari 2');
    fireEvent.click(screen.getByRole('button', { name: 'Halaman berikutnya' }));
    expect(await screen.findByText('Kristal')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Tanaman'), { target: { value: 'guava' } });
    fireEvent.change(screen.getByLabelText('Status siklus'), { target: { value: 'growing' } });
    expect(await screen.findByText('Halaman 1 dari 1')).toBeInTheDocument();
    expect(within(screen.getAllByRole('row')[1]).getByRole('cell', { name: '1' })).toBeInTheDocument();
    expect(screen.getByText('Kristal')).toBeInTheDocument();
    expect(screen.queryByText('Blok 1')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Atur ulang filter' }));
    expect(await screen.findByText('Halaman 1 dari 2')).toBeInTheDocument();
    expect(screen.queryByText('Kristal')).not.toBeInTheDocument();
  });

  it('filters by lahan autocomplete with keyboard selection', async () => {
    renderPage();
    await screen.findByText('Halaman 1 dari 2');

    const farmFilter = screen.getByRole('combobox', { name: 'Lahan' });
    fireEvent.focus(farmFilter);
    fireEvent.change(farmFilter, { target: { value: 'jambu' } });
    expect(screen.getByRole('option', { name: /Kebun Jambu/ })).toBeInTheDocument();
    fireEvent.keyDown(farmFilter, { key: 'ArrowDown' });
    fireEvent.keyDown(farmFilter, { key: 'Enter' });
    expect(await screen.findByText('Kristal')).toBeInTheDocument();
    expect(screen.queryByText('Blok 1')).not.toBeInTheDocument();
    expect(screen.getByText('Halaman 1 dari 1')).toBeInTheDocument();
  });
});
