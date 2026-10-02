import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PredictionsHistoryPage } from '@/routes/predictions/HistoryPage';
import * as predictionsService from '@/services/predictions';

vi.mock('@/services/predictions');

const manyPredictions = [
  ...Array.from({ length: 11 }, (_, index) => ({
    id: `pred-${index + 1}`,
    feature_type: 'harvest',
    model_version: 'harvest-v1',
    inputs_snapshot: {},
    output: { status: 'ok' },
    confidence: 70 + index,
    assumptions: null,
    explanation: null,
    recommendation: `Rekomendasi ${index + 1}`,
    provenance: null,
    client_operation_id: `client-${index + 1}`,
    created_at: `2026-08-${String((index % 28) + 1).padStart(2, '0')}T10:00:00Z`,
    crop_cycle_id: 'cycle-1',
    farm_id: 'farm-1',
  })),
  {
    id: 'pred-na-1',
    feature_type: 'rejuvenation',
    model_version: 'rules-v1',
    inputs_snapshot: {},
    output: { status: 'not_applicable', reason: 'Bukan jambu' },
    confidence: null,
    assumptions: null,
    explanation: null,
    recommendation: 'Tidak Berlaku',
    provenance: null,
    client_operation_id: 'client-na-1',
    created_at: '2026-08-15T10:00:00Z',
    crop_cycle_id: 'cycle-2',
    farm_id: 'farm-1',
  },
];

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <PredictionsHistoryPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('PredictionsHistoryPage list controls', () => {
  beforeEach(() => {
    vi.mocked(predictionsService.listPredictions).mockImplementation(async (params = {}) => {
      const page = params.page ?? 1;
      const pageSize = params.pageSize && params.pageSize > 0 ? params.pageSize : 10;
      let items = manyPredictions;
      if (params.featureType) {
        items = items.filter((prediction) => prediction.feature_type === params.featureType);
      }
      if (params.status === 'not_applicable') {
        items = items.filter((prediction) => prediction.output?.status === 'not_applicable');
      } else if (params.status === 'applicable') {
        items = items.filter((prediction) => prediction.output?.status !== 'not_applicable');
      }
      if (params.dateFrom) {
        items = items.filter((prediction) => prediction.created_at.slice(0, 10) >= params.dateFrom!);
      }
      if (params.dateTo) {
        items = items.filter((prediction) => prediction.created_at.slice(0, 10) <= params.dateTo!);
      }
      const total = items.length;
      const start = (page - 1) * pageSize;
      return {
        items: items.slice(start, start + pageSize),
        page,
        page_size: pageSize,
        total,
        total_pages: Math.ceil(total / pageSize) || 0,
      };
    });
  });

  it('paginates predictions with No column and detail links', async () => {
    renderPage();
    expect(await screen.findByRole('columnheader', { name: 'No' })).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(11);
    expect(within(table).queryByText('70%')).not.toBeInTheDocument();
    expect(within(table).getAllByText('Keandalan aturan').length).toBeGreaterThan(0);
    expect(within(screen.getAllByRole('row')[1]).getByRole('cell', { name: '1' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Buka detail' })).toHaveLength(10);
    expect(within(table).queryByText('Tidak Berlaku')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Halaman berikutnya' }));
    expect(await screen.findByText('Halaman 2 dari 2')).toBeInTheDocument();
    expect(await screen.findByText('Tidak Berlaku')).toBeInTheDocument();
    expect(within(screen.getAllByRole('row')[1]).getByRole('cell', { name: '11' })).toBeInTheDocument();
  });

  it('filters by feature, status, and date range', async () => {
    renderPage();
    await screen.findByText('Halaman 1 dari 2');
    const table = screen.getByRole('table');

    fireEvent.focus(screen.getByRole('combobox', { name: 'Fitur' }));
    fireEvent.click(screen.getByRole('option', { name: 'Rejuvenasi Jambu' }));
    expect(await screen.findByText('Tidak Berlaku')).toBeInTheDocument();
    expect(screen.queryByText('Prediksi Panen')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Atur ulang filter' }));
    fireEvent.focus(screen.getByRole('combobox', { name: 'Status hasil' }));
    fireEvent.click(screen.getByRole('option', { name: 'Hasil berlaku' }));
    expect(await screen.findByText('Halaman 1 dari 2')).toBeInTheDocument();
    expect(within(table).queryByText('Tidak Berlaku')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Atur ulang filter' }));
    fireEvent.focus(screen.getByRole('combobox', { name: 'Status hasil' }));
    fireEvent.click(screen.getByRole('option', { name: 'Tidak Berlaku' }));
    expect(await screen.findByText('Tidak Berlaku')).toBeInTheDocument();
    expect(screen.getByText('Halaman 1 dari 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Atur ulang filter' }));
    await screen.findByLabelText('Sampai tanggal');
    fireEvent.change(screen.getByLabelText('Dari tanggal'), { target: { value: '2026-08-10' } });
    fireEvent.change(screen.getByLabelText('Sampai tanggal'), { target: { value: '2026-08-10' } });
    expect(await screen.findByText('Halaman 1 dari 1')).toBeInTheDocument();
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(within(table).queryByText('Tidak Berlaku')).not.toBeInTheDocument();
  });

  it('shows feature autocomplete suggestions from loaded history', async () => {
    renderPage();
    await screen.findByText('Halaman 1 dari 2');

    const featureFilter = screen.getByRole('combobox', { name: 'Fitur' });
    fireEvent.focus(featureFilter);
    fireEvent.change(featureFilter, { target: { value: 'reju' } });
    expect(screen.getByRole('option', { name: 'Rejuvenasi Jambu' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: 'Rejuvenasi Jambu' }));
    expect(await screen.findByText('Tidak Berlaku')).toBeInTheDocument();
    expect(screen.getByLabelText('Dari tanggal')).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText('Sampai tanggal')).toHaveAttribute('type', 'date');
    expect(document.querySelector('.list-toolbar-filters-history')).toBeTruthy();
    expect(document.querySelector('.history-date-filters')).toBeTruthy();
    const filterLabels = Array.from(
      document.querySelectorAll('.list-toolbar-filters-history label'),
    ).map((label) => label.textContent);
    expect(filterLabels.slice(0, 5)).toEqual([
      'Cari riwayat',
      'Fitur',
      'Status hasil',
      'Dari tanggal',
      'Sampai tanggal',
    ]);
  });

  it('shows empty filter message', async () => {
    renderPage();
    await screen.findByText('Halaman 1 dari 2');

    fireEvent.change(screen.getByLabelText('Cari riwayat'), { target: { value: 'tidak-ada-sama-sekali' } });
    expect(await screen.findByText('Tidak ada prediksi yang cocok dengan filter.')).toBeInTheDocument();
  });

  it('shows error with retry, not the empty state, when listPredictions rejects', async () => {
    vi.mocked(predictionsService.listPredictions).mockRejectedValue(new Error('network down'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Gagal memuat riwayat prediksi');
    expect(screen.getByRole('button', { name: 'Coba lagi' })).toBeInTheDocument();
    expect(screen.queryByText('Belum ada prediksi tersimpan.')).not.toBeInTheDocument();
  });
});
