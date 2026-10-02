import { describe, expect, it } from 'vitest';
import {
  HARVEST_STAGE_LABELS,
  harvestStageLabel,
  localizeHarvestStageCopy,
} from '@/lib/harvestStages';

describe('harvest stage labels', () => {
  it('maps every known predict_harvest stage to Indonesian', () => {
    expect(HARVEST_STAGE_LABELS).toEqual({
      not_yet_planted: 'Belum Ditanam',
      vegetative: 'Vegetatif',
      reproductive: 'Reproduktif',
      ripening: 'Pematangan',
      near_harvest: 'Mendekati Panen',
      overdue: 'Jendela Panen Terlewat',
      harvested: 'Sudah Dipanen',
    });
    expect(harvestStageLabel('vegetative')).toBe('Vegetatif');
    expect(harvestStageLabel('reproductive')).toBe('Reproduktif');
    expect(harvestStageLabel('ripening')).toBe('Pematangan');
    expect(harvestStageLabel('near_harvest')).toBe('Mendekati Panen');
    expect(harvestStageLabel('NEAR-HARVEST')).toBe('Mendekati Panen');
    expect(harvestStageLabel('Vegetative')).toBe('Vegetatif');
  });

  it('uses an Indonesian fallback instead of showing snake_case', () => {
    expect(harvestStageLabel('late_tillering')).toBe('Tahap tidak diketahui');
    expect(harvestStageLabel('  ')).toBe('Tahap tidak diketahui');
    expect(harvestStageLabel('late_tillering')).not.toMatch(/_/);
  });

  it('rewrites stage tokens inside explanation copy', () => {
    expect(localizeHarvestStageCopy('Tahap pertumbuhan: vegetative')).toBe(
      'Tahap pertumbuhan: Vegetatif',
    );
    expect(localizeHarvestStageCopy('Tahap pertumbuhan: near_harvest')).toBe(
      'Tahap pertumbuhan: Mendekati Panen',
    );
    expect(localizeHarvestStageCopy('Tahap pertumbuhan: late_tillering')).toBe(
      'Tahap pertumbuhan: Tahap tidak diketahui',
    );
    expect(localizeHarvestStageCopy('Tahap pertumbuhan: late_tillering')).not.toMatch(/_/);
  });
});
