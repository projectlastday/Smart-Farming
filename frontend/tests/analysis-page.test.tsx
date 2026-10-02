import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalysisPage } from '@/routes/AnalysisPage';
import * as farmsService from '@/services/farms';
import * as predictionsService from '@/services/predictions';

vi.mock('@/services/farms');
vi.mock('@/services/predictions');

const farm = { id: 'farm-1', name: 'Sawah Ngemplak', location: 'Semarang', farmer_id: 'farmer-1' };
const cycles = [
  {
    id: 'rice-1',
    farm_id: 'farm-1',
    crop: 'rice',
    variety: 'Ciherang',
    planting_date: '2026-03-01',
    area: 1,
    location: 'Semarang',
    lifecycle_status: 'growing',
  },
  {
    id: 'guava-1',
    farm_id: 'farm-1',
    crop: 'guava',
    variety: 'Kristal',
    planting_date: '2026-03-01',
    area: 1,
    location: 'Demak',
    lifecycle_status: 'growing',
  },
];

const predictions = [
  {
    id: 'pred-h',
    feature_type: 'harvest',
    model_version: 'harvest-duration-v1',
    inputs_snapshot: {},
    output: { estimated_harvest_start: '2026-06-24', status: 'ok' },
    confidence: 65,
    assumptions: null,
    explanation: 'Tahap pertumbuhan: vegetative',
    recommendation: 'Pantau kondisi lapangan.',
    provenance: null,
    client_operation_id: 'op-h',
    created_at: '2026-08-31T10:00:00Z',
    crop_cycle_id: 'rice-1',
    farm_id: 'farm-1',
  },
  {
    id: 'pred-r',
    feature_type: 'rejuvenation',
    model_version: 'rejuvenation-rules-v1',
    inputs_snapshot: {},
    output: { status: 'ok' },
    confidence: null,
    assumptions: null,
    explanation: 'Pohon perlu dipantau.',
    recommendation: 'Evaluasi kondisi pohon.',
    provenance: null,
    client_operation_id: 'op-r',
    created_at: '2026-08-30T10:00:00Z',
    crop_cycle_id: 'guava-1',
    farm_id: 'farm-1',
  },
  {
    id: 'pred-na',
    feature_type: 'disease',
    model_version: 'disease-rules-v1',
    inputs_snapshot: {},
    output: { status: 'not_applicable' },
    confidence: null,
    assumptions: null,
    explanation: 'Tidak berlaku untuk jambu.',
    recommendation: 'Gunakan fitur yang sesuai.',
    provenance: null,
    client_operation_id: 'op-na',
    created_at: '2026-08-29T10:00:00Z',
    crop_cycle_id: 'guava-1',
    farm_id: 'farm-1',
  },
];

function renderAnalysis() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={['/analysis']}>
      <QueryClientProvider client={queryClient}>
        <AnalysisPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('AnalysisPage', () => {
  beforeEach(() => {
    vi.mocked(farmsService.listFarms).mockResolvedValue([farm]);
    vi.mocked(farmsService.listCropCycles).mockResolvedValue(cycles);
    vi.mocked(predictionsService.listPredictions).mockImplementation(async (params = {}) => {
      let items = predictions;
      if (params.farmId) items = items.filter((prediction) => prediction.farm_id === params.farmId);
      if (params.cropCycleId) items = items.filter((prediction) => prediction.crop_cycle_id === params.cropCycleId);
      if (params.featureType) items = items.filter((prediction) => prediction.feature_type === params.featureType);
      if (params.status === 'not_applicable') {
        items = items.filter((prediction) => prediction.output.status === 'not_applicable');
      } else if (params.status === 'applicable') {
        items = items.filter((prediction) => prediction.output.status !== 'not_applicable');
      }
      if (params.dateFrom) items = items.filter((prediction) => prediction.created_at.slice(0, 10) >= params.dateFrom!);
      if (params.dateTo) items = items.filter((prediction) => prediction.created_at.slice(0, 10) <= params.dateTo!);
      const page = params.page ?? 1;
      const pageSize = params.pageSize ?? 100;
      const start = (page - 1) * pageSize;
      return {
        items: items.slice(start, start + pageSize),
        page,
        page_size: pageSize,
        total: items.length,
        total_pages: Math.ceil(items.length / pageSize) || 0,
      };
    });
  });

  it('lists predictions across cycles and provides a Buka action for each detail', async () => {
    renderAnalysis();

    expect(await screen.findByRole('heading', { name: 'Analisis Tanaman' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Daftar prediksi' })).toBeInTheDocument();
    expect(screen.getByText('Prediksi Panen')).toBeInTheDocument();
    expect(screen.getByText('Rejuvenasi Jambu')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Lahan' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Siklus Tanam' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Analisis semua yang tersedia' })).not.toBeInTheDocument();

    const openLinks = screen.getAllByRole('link', { name: 'Buka' });
    expect(openLinks).toHaveLength(3);
    expect(openLinks[0]).toHaveAttribute('href', '/predictions/pred-h');
    expect(openLinks[1]).toHaveAttribute('href', '/predictions/pred-r');
    expect(openLinks[2]).toHaveAttribute('href', '/predictions/pred-na');
    await waitFor(() => {
      expect(predictionsService.listPredictions).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, pageSize: 100 }),
      );
    });
  });

  it('filters by farm, cycle, feature, status, and date range', async () => {
    renderAnalysis();

    await screen.findByRole('heading', { name: 'Daftar prediksi' });
    fireEvent.focus(screen.getByRole('combobox', { name: 'Fitur' }));
    fireEvent.click(screen.getByRole('option', { name: 'Rejuvenasi Jambu' }));
    expect(await screen.findByText('Rejuvenasi Jambu')).toBeInTheDocument();
    expect(screen.queryByText('Prediksi Panen')).not.toBeInTheDocument();
    expect(predictionsService.listPredictions).toHaveBeenLastCalledWith(
      expect.objectContaining({ featureType: 'rejuvenation', page: 1 }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Atur ulang filter' }));
    fireEvent.focus(screen.getByRole('combobox', { name: 'Status hasil' }));
    fireEvent.click(screen.getByRole('option', { name: 'Tidak Berlaku' }));
    expect(await screen.findByText('Tidak Berlaku')).toBeInTheDocument();
    expect(predictionsService.listPredictions).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'not_applicable', page: 1 }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Atur ulang filter' }));
    fireEvent.focus(screen.getByRole('combobox', { name: 'Lahan' }));
    fireEvent.click(screen.getByRole('option', { name: /Sawah Ngemplak/ }));
    expect(predictionsService.listPredictions).toHaveBeenLastCalledWith(
      expect.objectContaining({ farmId: 'farm-1', page: 1 }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Atur ulang filter' }));
    fireEvent.focus(screen.getByRole('combobox', { name: 'Siklus Tanam' }));
    fireEvent.click(screen.getByRole('option', { name: /Jambu/i }));
    expect(predictionsService.listPredictions).toHaveBeenLastCalledWith(
      expect.objectContaining({ cropCycleId: 'guava-1', page: 1 }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Atur ulang filter' }));
    fireEvent.change(screen.getByLabelText('Dari tanggal'), { target: { value: '2026-08-31' } });
    fireEvent.change(screen.getByLabelText('Sampai tanggal'), { target: { value: '2026-08-31' } });
    await waitFor(() => {
      expect(predictionsService.listPredictions).toHaveBeenLastCalledWith(
        expect.objectContaining({ dateFrom: '2026-08-31', dateTo: '2026-08-31', page: 1 }),
      );
    });
  });

  it('paginates when there are more than one hundred predictions', async () => {
    vi.mocked(predictionsService.listPredictions).mockReset();
    vi.mocked(predictionsService.listPredictions)
      .mockResolvedValueOnce({ items: [predictions[0]], page: 1, page_size: 100, total: 101, total_pages: 2 })
      .mockResolvedValueOnce({ items: [predictions[1]], page: 2, page_size: 100, total: 101, total_pages: 2 });
    renderAnalysis();

    expect(await screen.findByRole('button', { name: 'Halaman berikutnya' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Halaman berikutnya' }));
    await waitFor(() => {
      expect(predictionsService.listPredictions).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2, pageSize: 100 }),
      );
    });
    expect(await screen.findByRole('link', { name: 'Buka' })).toHaveAttribute(
      'href',
      '/predictions/pred-r',
    );
  });

  it('shows the empty state', async () => {
    vi.mocked(predictionsService.listPredictions).mockReset();
    vi.mocked(predictionsService.listPredictions).mockResolvedValue({
      items: [],
      page: 1,
      page_size: 100,
      total: 0,
      total_pages: 0,
    });
    renderAnalysis();
    expect(await screen.findByText('Belum ada prediksi tersimpan.')).toBeInTheDocument();
  });

  it('shows error with retry instead of the empty state', async () => {
    vi.mocked(predictionsService.listPredictions).mockReset();
    vi.mocked(predictionsService.listPredictions).mockRejectedValue(new Error('network down'));
    renderAnalysis();
    expect(await screen.findByText('Gagal memuat daftar prediksi.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Coba lagi' })).toBeInTheDocument();
  });
});
