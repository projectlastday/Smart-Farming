import { describe, expect, it } from 'vitest';
import { cycleMatchesListFilters, uniqueCycleFieldOptions } from '@/lib/cropCycleFilters';
import type { CropCycle, Farm } from '@/types';

const farms: Farm[] = [
  { id: 'farm-1', name: 'Sawah Demo', location: 'Demak', farmer_id: 'f1' },
  { id: 'farm-2', name: 'Kebun Jambu', location: 'Kudus', farmer_id: 'f1' },
];

const rice: CropCycle = {
  id: 'c1',
  farm_id: 'farm-1',
  crop: 'rice',
  variety: 'Ciherang',
  planting_date: '2026-03-01',
  area: 1,
  location: 'Blok A',
  lifecycle_status: 'growing',
};

const guava: CropCycle = {
  id: 'c2',
  farm_id: 'farm-2',
  crop: 'guava',
  variety: 'Kristal',
  planting_date: '2010-01-01',
  area: 2,
  location: 'Kebun Jambu',
  lifecycle_status: 'harvested',
};

const empty = {
  farmFilter: '',
  cropFilter: '',
  varietyFilter: '',
  locationFilter: '',
  statusFilter: '',
};

describe('crop cycle list filters', () => {
  it('filters by variety and location separately', () => {
    expect(cycleMatchesListFilters(rice, farms, { ...empty, varietyFilter: 'Kristal' })).toBe(false);
    expect(cycleMatchesListFilters(guava, farms, { ...empty, varietyFilter: 'Kristal' })).toBe(true);
    expect(cycleMatchesListFilters(rice, farms, { ...empty, locationFilter: 'Blok A' })).toBe(true);
    expect(cycleMatchesListFilters(guava, farms, { ...empty, locationFilter: 'Blok A' })).toBe(false);
  });

  it('combines lahan, tanaman, and status', () => {
    expect(
      cycleMatchesListFilters(rice, farms, {
        ...empty,
        farmFilter: 'farm-1',
        cropFilter: 'rice',
        statusFilter: 'growing',
      }),
    ).toBe(true);
    expect(
      cycleMatchesListFilters(rice, farms, {
        ...empty,
        farmFilter: 'farm-1',
        cropFilter: 'guava',
        statusFilter: 'growing',
      }),
    ).toBe(false);
    expect(
      cycleMatchesListFilters(guava, farms, {
        ...empty,
        farmFilter: 'farm-2',
        varietyFilter: 'Kristal',
        locationFilter: 'Kebun Jambu',
      }),
    ).toBe(true);
  });

  it('builds unique variety and location suggestions from loaded cycles', () => {
    expect(uniqueCycleFieldOptions([rice, rice, guava], 'variety').map((option) => option.label)).toEqual([
      'Ciherang',
      'Kristal',
    ]);
    expect(uniqueCycleFieldOptions([rice, guava], 'location').map((option) => option.value)).toEqual([
      'Blok A',
      'Kebun Jambu',
    ]);
  });
});
