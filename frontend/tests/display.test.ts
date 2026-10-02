import { describe, expect, it } from 'vitest';
import { featureTypeLabel, humanizeCode, lifecycleDisplayLabel, queueStatusLabel } from '@/lib/display';

describe('display labels', () => {
  it('maps lifecycle and feature codes to Indonesian', () => {
    expect(lifecycleDisplayLabel('growing')).toBe('Tumbuh');
    expect(lifecycleDisplayLabel('harvest-ready')).toBe('Siap Panen');
    expect(featureTypeLabel('harvest')).toBe('Prediksi Panen');
    expect(queueStatusLabel('pending')).toBe('Menunggu');
  });

  it('humanizes unknown snake_case instead of showing raw codes', () => {
    expect(humanizeCode('late_tillering')).toBe('Late Tillering');
    expect(lifecycleDisplayLabel('mystery_status')).toBe('Mystery Status');
    expect(humanizeCode('late_tillering')).not.toMatch(/_/);
  });
});
