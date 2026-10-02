import { describe, expect, it } from 'vitest';
import {
  compactReliabilityCaption,
  historyReliabilityLabel,
  isNotApplicableOutput,
} from '@/lib/reliability';
import type { Prediction } from '@/types';

const base: Prediction = {
  id: 'p1',
  feature_type: 'soil',
  model_version: 'soil-rules-v1',
  inputs_snapshot: {},
  output: {},
  confidence: 70,
  assumptions: null,
  explanation: null,
  recommendation: null,
  provenance: null,
  client_operation_id: 'op-1',
  created_at: '2026-08-31T10:00:00Z',
  crop_cycle_id: 'rice-1',
  farm_id: 'farm-1',
};

describe('reliability captions', () => {
  it('does not treat a leftover confidence number as model probability', () => {
    expect(compactReliabilityCaption({ ...base, output: { status: 'ok' } })).toBeNull();
    expect(historyReliabilityLabel({ ...base, output: { status: 'ok' } })).toEqual({
      badge: null,
      text: 'Keandalan aturan',
    });
  });

  it('labels classified disease as model probability', () => {
    const disease: Prediction = {
      ...base,
      feature_type: 'disease',
      output: {
        status: 'classified',
        label: 'blast',
        reliability: { kind: 'model_probability', label: 'Probabilitas model', score: 88 },
      },
      confidence: 88,
    };
    expect(compactReliabilityCaption(disease)).toBe('Probabilitas model 88.0%');
    expect(historyReliabilityLabel(disease)).toEqual({
      badge: null,
      text: 'Probabilitas model 88.0%',
    });
  });

  it('labels rule results as rule completeness, not a percentage meter', () => {
    const soil: Prediction = {
      ...base,
      output: {
        status: 'ok',
        reliability: { kind: 'rule_completeness', label: 'Keandalan aturan', score: 80 },
      },
      confidence: null,
    };
    expect(compactReliabilityCaption(soil)).toBe('Keandalan aturan 80/100');
    expect(historyReliabilityLabel(soil).text).toBe('Keandalan aturan 80/100');
  });

  it('hides reliability copy for not-applicable results', () => {
    const na: Prediction = {
      ...base,
      output: { status: 'not_applicable', reason: 'Bukan padi' },
      confidence: null,
    };
    expect(isNotApplicableOutput(na.output)).toBe(true);
    expect(compactReliabilityCaption(na)).toBeNull();
    expect(historyReliabilityLabel(na)).toEqual({
      badge: 'not_applicable',
      text: 'Tidak Berlaku',
    });
  });
});
