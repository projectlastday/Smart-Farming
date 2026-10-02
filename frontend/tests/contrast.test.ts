import { describe, expect, it } from 'vitest';
import { contrastRatio } from '@/lib/contrast';

describe('theme contrast tokens', () => {
  it('body text on page background meets 4.5:1', () => {
    expect(contrastRatio('#1e2a16', '#f4f7f0')).toBeGreaterThanOrEqual(4.5);
  });

  it('muted text on page and surface meets 4.5:1', () => {
    expect(contrastRatio('#3d4a36', '#f4f7f0')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#3d4a36', '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });

  it('primary button white on green meets 4.5:1', () => {
    expect(contrastRatio('#ffffff', '#2d5016')).toBeGreaterThanOrEqual(4.5);
  });

  it('error text is readable on white', () => {
    expect(contrastRatio('#b91c1c', '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });
});
