import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PredictionResult } from '@/components/PredictionResult';
import type { Prediction } from '@/types';

const prediction: Prediction = {
  id: 'pred-soil',
  feature_type: 'soil',
  model_version: 'soil-rules-v1',
  inputs_snapshot: {},
  output: {
    status: 'ok',
    reliability: { kind: 'rule_completeness', label: 'Keandalan aturan', score: 80 },
  },
  confidence: null,
  assumptions: 'Nilai input manual.',
  explanation: 'pH dalam kisaran sedang.',
  recommendation: 'Tambah bahan organik.',
  provenance: null,
  client_operation_id: 'op-1',
  created_at: '2026-08-31T00:00:00Z',
  crop_cycle_id: 'rice-1',
  farm_id: 'farm-1',
};

describe('PredictionResult', () => {
  it('separates confidence, explanation, recommendation, and assumptions', () => {
    render(<PredictionResult prediction={prediction} />);
    expect(screen.getByRole('heading', { name: 'Hasil: Analisis Tanah' })).toBeInTheDocument();
    expect(screen.queryByRole('meter')).not.toBeInTheDocument();
    expect(screen.getByText('80/100 (kelengkapan input/aturan, bukan probabilitas model)')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Penjelasan' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Rekomendasi' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Asumsi' })).toBeInTheDocument();
  });
});
