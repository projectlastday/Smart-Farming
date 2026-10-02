import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HarvestPage } from '@/routes/features/HarvestPage';
import * as farmsService from '@/services/farms';
import * as featuresService from '@/services/features';

vi.mock('@/services/farms');
vi.mock('@/services/features');

const riceCycle = {
  id: 'rice-1',
  farm_id: 'farm-1',
  crop: 'rice',
  variety: 'Ciherang',
  planting_date: '2026-03-01',
  area: 1,
  location: 'Blok A',
  lifecycle_status: 'growing',
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <HarvestPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('HarvestPage searchable fields', () => {
  beforeEach(() => {
    vi.mocked(farmsService.listCropCycles).mockResolvedValue([riceCycle]);
    vi.mocked(featuresService.runHarvest).mockResolvedValue({
      id: 'pred-1',
      feature_type: 'harvest',
      model_version: 'harvest-duration-v1',
      inputs_snapshot: {},
      output: {
        estimated_harvest_start: '2026-06-24',
        estimated_harvest_end: '2026-07-04',
        growth_stage: 'vegetative',
        reliability: { kind: 'rule_completeness', label: 'Keandalan aturan', score: 85 },
        limitations: ['Estimasi berbasis durasi varietas, bukan kalibrasi lapangan lokal.'],
      },
      confidence: null,
      assumptions: 'Durasi varietas sebagai prior transparan.',
      explanation: 'Tahap pertumbuhan: vegetative',
      recommendation: 'Pantau kondisi lapangan dan sesuaikan jadwal panen.',
      provenance: null,
      client_operation_id: 'op-1',
      created_at: '2026-08-31T00:00:00Z',
      crop_cycle_id: 'rice-1',
      farm_id: 'farm-1',
    });
  });

  it('lets the user search and pick a rice variety', async () => {
    renderPage();
    const variety = await screen.findByRole('combobox', { name: 'Varietas Padi' });
    fireEvent.focus(variety);
    fireEvent.change(variety, { target: { value: 'inpari' } });
    expect(screen.getByRole('option', { name: 'Inpari 32' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Ciherang' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: 'Inpari 32' }));
    expect(variety).toHaveValue('Inpari 32');
  });

  it('shows no-match for unknown variety and requires a selected cycle', async () => {
    renderPage();
    const variety = await screen.findByRole('combobox', { name: 'Varietas Padi' });
    fireEvent.focus(variety);
    fireEvent.change(variety, { target: { value: 'xyz-bukan-varietas' } });
    expect(screen.getByText('Tidak ada varietas yang cocok')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Prediksi Panen' })).toBeDisabled();
  });

  it('renders the harvest result card after a successful prediction', async () => {
    renderPage();
    const cycle = await screen.findByRole('combobox', { name: 'Siklus Tanam' });
    fireEvent.focus(cycle);
    fireEvent.click(screen.getByRole('option', { name: /Ciherang/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Prediksi Panen' }));
    expect(await screen.findByRole('heading', { name: 'Prediksi Panen' })).toBeInTheDocument();
    expect(screen.queryByRole('meter')).not.toBeInTheDocument();
    expect(screen.getByText(/Keandalan aturan/)).toBeInTheDocument();
    expect(screen.getByText('Perkiraan jendela panen')).toBeInTheDocument();
  });
});
