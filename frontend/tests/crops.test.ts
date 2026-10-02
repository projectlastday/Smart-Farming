import { describe, expect, it } from 'vitest';
import { cycleMatchesCropFilter, cropDisplayLabel, normalizeCropKey } from '@/lib/crops';

describe('crop filter helpers', () => {
  it('treats padi aliases as rice', () => {
    expect(normalizeCropKey('Padi')).toBe('rice');
    expect(cycleMatchesCropFilter('padi', 'rice')).toBe(true);
    expect(cycleMatchesCropFilter('Rice', 'padi')).toBe(true);
    expect(cropDisplayLabel('rice')).toBe('Padi');
  });

  it('excludes guava from rice filters', () => {
    expect(cycleMatchesCropFilter('guava', 'rice')).toBe(false);
    expect(cycleMatchesCropFilter('Jambu Biji', 'rice')).toBe(false);
    expect(cycleMatchesCropFilter('guava', 'guava')).toBe(true);
  });
});
