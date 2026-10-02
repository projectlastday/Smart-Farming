import { FEATURE_LABELS, LIFECYCLE_OPTIONS } from '@/types';

export function humanizeCode(value: string): string {
  const words = value
    .trim()
    .replace(/[_-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
  return words.length > 0 ? words.join(' ') : 'Tidak diketahui';
}

export function lifecycleDisplayLabel(status: string): string {
  return LIFECYCLE_OPTIONS.find((option) => option.value === status)?.label ?? humanizeCode(status);
}

export function featureTypeLabel(featureType: string): string {
  return FEATURE_LABELS[featureType] ?? humanizeCode(featureType);
}

export function queueStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Menunggu',
    syncing: 'Menyinkronkan',
    failed: 'Gagal',
    synced: 'Tersinkron',
  };
  return labels[status] ?? humanizeCode(status);
}
