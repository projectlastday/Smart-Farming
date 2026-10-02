export function normalizeCropKey(crop: string): string {
  const value = crop.trim().toLowerCase();
  if (value === 'rice' || value === 'padi') return 'rice';
  if (value === 'guava' || value.includes('jambu')) return 'guava';
  return value;
}

export function cycleMatchesCropFilter(crop: string, filterCrop?: string): boolean {
  if (!filterCrop) return true;
  return normalizeCropKey(crop) === normalizeCropKey(filterCrop);
}

export function cropDisplayLabel(crop: string): string {
  const key = normalizeCropKey(crop);
  if (key === 'rice') return 'Padi';
  if (key === 'guava') return 'Jambu Biji';
  return crop;
}
