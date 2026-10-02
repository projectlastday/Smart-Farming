import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FarmsPage } from '@/routes/FarmsPage';
import * as farmsService from '@/services/farms';
import { ApiClientError } from '@/services/api';

vi.mock('@/services/farms');

const sampleFarm = {
  id: 'farm-1',
  name: 'Sawah Demo',
  location: 'Demak',
  farmer_id: 'farmer-1',
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <FarmsPage />
    </QueryClientProvider>,
  );
}

describe('FarmsPage CRUD UI', () => {
  beforeEach(() => {
    vi.mocked(farmsService.listFarms).mockResolvedValue([sampleFarm]);
    vi.mocked(farmsService.createFarm).mockResolvedValue(sampleFarm);
    vi.mocked(farmsService.updateFarm).mockResolvedValue({
      ...sampleFarm,
      name: 'Sawah Baru',
      location: 'Kudus',
    });
    vi.mocked(farmsService.deleteFarm).mockResolvedValue({ message: 'Lahan berhasil dihapus' });
  });

  it('lists farms with Ubah and Hapus controls', async () => {
    renderPage();
    expect(await screen.findByRole('cell', { name: 'Sawah Demo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ubah lahan Sawah Demo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hapus lahan Sawah Demo' })).toBeInTheDocument();
  });

  it('opens prefilled edit form and saves changes', async () => {
    renderPage();
    await screen.findByRole('cell', { name: 'Sawah Demo' });
    fireEvent.click(screen.getByRole('button', { name: 'Ubah lahan Sawah Demo' }));

    expect(screen.getByRole('heading', { name: 'Ubah Lahan' })).toBeInTheDocument();
    const nameInput = screen.getByLabelText('Nama Lahan');
    const locationInput = screen.getByLabelText('Lokasi');
    expect(nameInput).toHaveValue('Sawah Demo');
    expect(locationInput).toHaveValue('Demak');

    fireEvent.change(nameInput, { target: { value: 'Sawah Baru' } });
    fireEvent.change(locationInput, { target: { value: 'Kudus' } });
    fireEvent.click(screen.getByRole('button', { name: 'Simpan Perubahan' }));

    await waitFor(() => {
      expect(farmsService.updateFarm).toHaveBeenCalledWith('farm-1', {
        name: 'Sawah Baru',
        location: 'Kudus',
      });
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Perubahan lahan berhasil disimpan.');
  });

  it('requires confirmation before delete and shows dependency errors', async () => {
    vi.mocked(farmsService.deleteFarm).mockRejectedValueOnce(
      new ApiClientError(409, 'Lahan masih memiliki 1 siklus tanam. Hapus semua siklus tanam terlebih dahulu.'),
    );

    renderPage();
    await screen.findByRole('cell', { name: 'Sawah Demo' });
    fireEvent.click(screen.getByRole('button', { name: 'Hapus lahan Sawah Demo' }));

    expect(screen.getByRole('dialog', { name: 'Hapus lahan?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Batal' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hapus lahan Sawah Demo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ya, Hapus' }));

    expect(await screen.findByText(/siklus tanam/i)).toBeInTheDocument();
  });

  it('shows error with retry, not the empty state, when listFarms rejects', async () => {
    vi.mocked(farmsService.listFarms).mockRejectedValue(
      new ApiClientError(500, 'Server sedang bermasalah. Coba lagi.'),
    );
    renderPage();
    expect(await screen.findByRole('alert', {}, { timeout: 4000 })).toHaveTextContent(
      'Gagal memuat lahan',
    );
    expect(screen.getByRole('button', { name: 'Coba lagi' })).toBeInTheDocument();
    expect(screen.queryByText('Belum ada lahan. Tambahkan lahan pertama Anda.')).not.toBeInTheDocument();
  });

  it('deletes farm after confirmation', async () => {
    renderPage();
    await screen.findByRole('cell', { name: 'Sawah Demo' });
    fireEvent.click(screen.getByRole('button', { name: 'Hapus lahan Sawah Demo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ya, Hapus' }));

    await waitFor(() => {
      expect(farmsService.deleteFarm).toHaveBeenCalledWith('farm-1');
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Lahan berhasil dihapus.');
  });
});
