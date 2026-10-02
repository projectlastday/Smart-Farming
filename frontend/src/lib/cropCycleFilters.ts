import { optionMatchesFilter } from '@/lib/autocomplete';
import { CROP_OPTIONS, LIFECYCLE_OPTIONS, type CropCycle, type Farm } from '@/types';

export type CycleListFilters = {
  farmFilter: string;
  cropFilter: string;
  varietyFilter: string;
  locationFilter: string;
  statusFilter: string;
};

export function cycleMatchesListFilters(
  cycle: CropCycle,
  farms: Farm[],
  filters: CycleListFilters,
): boolean {
  const farm = farms.find((item) => item.id === cycle.farm_id);
  if (filters.farmFilter) {
    const matchesId = cycle.farm_id === filters.farmFilter;
    const matchesFarmText = farm
      ? optionMatchesFilter(filters.farmFilter, farm.id, `${farm.name} ${farm.location}`)
      : optionMatchesFilter(filters.farmFilter, cycle.farm_id);
    if (!matchesId && !matchesFarmText) return false;
  }
  if (
    !optionMatchesFilter(
      filters.cropFilter,
      cycle.crop,
      CROP_OPTIONS.find((option) => option.value === cycle.crop)?.label ?? '',
    )
  ) {
    return false;
  }
  if (!optionMatchesFilter(filters.varietyFilter, cycle.variety, cycle.variety)) {
    return false;
  }
  if (!optionMatchesFilter(filters.locationFilter, cycle.location, cycle.location)) {
    return false;
  }
  if (
    !optionMatchesFilter(
      filters.statusFilter,
      cycle.lifecycle_status,
      LIFECYCLE_OPTIONS.find((option) => option.value === cycle.lifecycle_status)?.label ?? '',
    )
  ) {
    return false;
  }
  return true;
}

export function uniqueCycleFieldOptions(
  cycles: CropCycle[],
  field: 'variety' | 'location',
): { value: string; label: string }[] {
  return Array.from(new Set(cycles.map((cycle) => cycle[field]).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'id'))
    .map((value) => ({ value, label: value }));
}
