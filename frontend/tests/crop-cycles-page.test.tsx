import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CropCyclesPage } from '@/routes/CropCyclesPage';
import * as farmsService from '@/services/farms';
import { ApiClientError } from '@/services/api';

vi.mock('@/services/farms');

const sampleFarm = {
  id: 'farm-1',
  name: 'Sawah Demo',
  location: 'Demak',
  farmer_id: 'farmer-1',
};

const sampleCycle = {
  id: 'cycle-1',
  farm_id: 'farm-1',
  crop: 'rice',
  variety: 'Ciherang',
  planting_date: '2026-03-01',
  area: 1.25,
  location: 'Blok A',
  lifecycle_status: 'growing',
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CropCyclesPage />
    </QueryClientProvider>,
  );
}

describe('CropCyclesPage CRUD UI', () => {
  beforeEach(() => {
    vi.mocked(farmsService.listFarms).mockResolvedValue([sampleFarm]);
    vi.mocked(farmsService.listCropCycles).mockResolvedValue([sampleCycle]);
    vi.mocked(farmsService.updateCropCycle).mockResolvedValue({
      ...sampleCycle,
      location: 'Blok B',
      area: 2,
    });
    vi.mocked(farmsService.deleteCropCycle).mockResolvedValue({ message: 'Siklus tanam berhasil dihapus' });
  });

  it('lists cycles with Ubah and Hapus controls', async () => {
    renderPage();
    expect(await screen.findByText('Padi')).toBeInTheDocument();
    expect(screen.getByText('Tumbuh')).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'rice' })).not.toBeInTheDocument();
    expect(screen.queryByText('growing')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Ubah siklus Padi / Ciherang — 2026-03-01' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Hapus siklus Padi / Ciherang — 2026-03-01' }),
    ).toBeInTheDocument();
  });

  it('opens prefilled edit form and saves changes', async () => {
    renderPage();
    await screen.findByRole('cell', { name: '2026-03-01' });
    fireEvent.click(screen.getByRole('button', { name: 'Ubah siklus Padi / Ciherang — 2026-03-01' }));

    expect(screen.getByRole('heading', { name: 'Ubah Siklus Tanam' })).toBeInTheDocument();
    expect(screen.getByLabelText('Lokasi Spesifik')).toHaveValue('Blok A');
    fireEvent.change(screen.getByLabelText('Lokasi Spesifik'), { target: { value: 'Blok B' } });
    fireEvent.change(screen.getByLabelText('Luas (ha)'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Simpan Perubahan' }));

    await waitFor(() => {
      expect(farmsService.updateCropCycle).toHaveBeenCalledWith(
        'cycle-1',
        expect.objectContaining({
          farm_id: 'farm-1',
          crop: 'rice',
          location: 'Blok B',
          area: 2,
        }),
      );
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Perubahan siklus tanam berhasil disimpan.');
  });

  it('shows dependency error when delete is blocked', async () => {
    vi.mocked(farmsService.deleteCropCycle).mockRejectedValueOnce(
      new ApiClientError(
        409,
        'Siklus masih memiliki 1 riwayat prediksi. Riwayat prediksi tidak dapat dihapus otomatis; hubungi administrator jika diperlukan.',
      ),
    );

    renderPage();
    await screen.findByRole('cell', { name: '2026-03-01' });
    fireEvent.click(screen.getByRole('button', { name: 'Hapus siklus Padi / Ciherang — 2026-03-01' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ya, Hapus' }));

    expect(await screen.findByText(/riwayat prediksi/i)).toBeInTheDocument();
  });

  it('shows error with retry, not the empty state, when listCropCycles rejects', async () => {
    vi.mocked(farmsService.listFarms).mockResolvedValue([sampleFarm]);
    vi.mocked(farmsService.listCropCycles).mockRejectedValue(
      new ApiClientError(500, 'Server sedang bermasalah. Coba lagi.'),
    );
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Gagal memuat siklus tanam');
    expect(screen.getByRole('button', { name: 'Coba lagi' })).toBeInTheDocument();
    expect(screen.queryByText('Belum ada siklus tanam.')).not.toBeInTheDocument();
  });
});
