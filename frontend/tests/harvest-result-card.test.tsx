import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HarvestResultCard } from '@/components/HarvestResultCard';
import type { Prediction } from '@/types';

const harvestPrediction: Prediction = {
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
};

describe('HarvestResultCard', () => {
  it('shows harvest window, stage, rule reliability, and readable sections', () => {
    render(<HarvestResultCard prediction={harvestPrediction} />);

    expect(screen.getByRole('heading', { name: 'Prediksi Panen' })).toBeInTheDocument();
    expect(screen.getByLabelText('Tahap pertumbuhan: Vegetatif')).toHaveTextContent('Vegetatif');
    expect(screen.getByText('Perkiraan jendela panen')).toBeInTheDocument();
    expect(screen.getByText(/24 Juni 2026/)).toBeInTheDocument();
    expect(screen.getByText(/4 Juli 2026/)).toBeInTheDocument();
    expect(screen.queryByRole('meter')).not.toBeInTheDocument();
    expect(screen.getByText(/Keandalan aturan/)).toBeInTheDocument();
    expect(screen.getByText(/bukan probabilitas model/)).toBeInTheDocument();

    expect(screen.getByText('harvest-duration-v1')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Penjelasan' })).toBeInTheDocument();
    expect(screen.getByText('Tahap pertumbuhan: Vegetatif')).toBeInTheDocument();
    expect(screen.queryByText(/vegetative/)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Rekomendasi' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Asumsi' })).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent(/Estimasi berbasis durasi varietas/);
  });

  it.each([
    ['vegetative', 'Vegetatif'],
    ['reproductive', 'Reproduktif'],
    ['ripening', 'Pematangan'],
    ['near_harvest', 'Mendekati Panen'],
  ] as const)('shows Indonesian badge and copy for %s', (stage, label) => {
    render(
      <HarvestResultCard
        prediction={{
          ...harvestPrediction,
          output: { ...harvestPrediction.output, growth_stage: stage },
          explanation: `Tahap pertumbuhan: ${stage}`,
        }}
      />,
    );
    expect(screen.getByLabelText(`Tahap pertumbuhan: ${label}`)).toHaveTextContent(label);
    expect(screen.getByText(`Tahap pertumbuhan: ${label}`)).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(stage.replace('_', '[_-]')))).not.toBeInTheDocument();
  });

  it('uses an Indonesian fallback instead of showing snake_case', () => {
    render(
      <HarvestResultCard
        prediction={{
          ...harvestPrediction,
          output: { ...harvestPrediction.output, growth_stage: 'late_tillering' },
          explanation: 'Tahap pertumbuhan: late_tillering',
        }}
      />,
    );
    expect(screen.getByLabelText('Tahap pertumbuhan: Tahap tidak diketahui')).toHaveTextContent(
      'Tahap tidak diketahui',
    );
    expect(screen.getByText('Tahap pertumbuhan: Tahap tidak diketahui')).toBeInTheDocument();
    expect(screen.queryByText(/late_tillering/)).not.toBeInTheDocument();
    expect(screen.queryByText(/near_harvest/)).not.toBeInTheDocument();
  });

  it('does not invent a harvest date when output has no window', () => {
    render(
      <HarvestResultCard
        prediction={{
          ...harvestPrediction,
          output: { status: 'not_applicable', reason: 'Tidak berlaku' },
          confidence: null,
          explanation: 'Tidak berlaku',
          recommendation: 'Fitur tidak berlaku untuk tanaman ini.',
          assumptions: null,
        }}
      />,
    );

    expect(screen.getByText('Tidak Berlaku')).toBeInTheDocument();
    expect(screen.queryByText('Perkiraan jendela panen')).not.toBeInTheDocument();
    expect(screen.queryByRole('meter')).not.toBeInTheDocument();
  });
});
