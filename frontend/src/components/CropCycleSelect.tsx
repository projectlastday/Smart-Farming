import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Autocomplete } from '@/components/Autocomplete';
import type { AutocompleteOption } from '@/lib/autocomplete';
import { cropDisplayLabel, cycleMatchesCropFilter } from '@/lib/crops';
import { lifecycleDisplayLabel } from '@/lib/display';
import { listCropCycles } from '@/services/farms';

interface CropCycleSelectProps {
  value: string;
  onChange: (id: string) => void;
  filterCrop?: string;
  label?: string;
  id?: string;
}

export function cycleOptionLabel(cycle: {
  crop: string;
  variety: string;
  planting_date: string;
  lifecycle_status: string;
}): string {
  return `${cropDisplayLabel(cycle.crop)} / ${cycle.variety} — ${cycle.planting_date} (${lifecycleDisplayLabel(cycle.lifecycle_status)})`;
}

export function CropCycleSelect({
  value,
  onChange,
  filterCrop,
  label = 'Siklus Tanam',
  id = 'crop-cycle-select',
}: CropCycleSelectProps) {
  const { data: cycles = [], isLoading, isError } = useQuery({
    queryKey: ['crop-cycles'],
    queryFn: listCropCycles,
    retry: 1,
  });

  const filtered = filterCrop
    ? cycles.filter((cycle) => cycleMatchesCropFilter(cycle.crop, filterCrop))
    : cycles;

  const options = useMemo<AutocompleteOption[]>(
    () =>
      filtered.map((cycle) => ({
        value: cycle.id,
        label: cycleOptionLabel(cycle),
        description: cycle.location,
      })),
    [filtered],
  );

  useEffect(() => {
    if (!filterCrop || !value || cycles.length === 0) return;
    if (!filtered.some((cycle) => cycle.id === value)) {
      onChange('');
    }
  }, [filterCrop, value, cycles, filtered, onChange]);

  if (isLoading && cycles.length === 0) {
    return <p>Memuat siklus tanam...</p>;
  }

  if (isError && filtered.length === 0) {
    return (
      <div className="alert alert-error" role="alert">
        Gagal memuat siklus tanam. Coba lagi saat online.
      </div>
    );
  }

  if (filtered.length === 0) {
    const cropHint = filterCrop ? ` untuk ${cropDisplayLabel(filterCrop)}` : '';
    return (
      <div className="alert alert-warning">
        Belum ada siklus tanam{cropHint}. Buat siklus di menu Siklus Tanam.
      </div>
    );
  }

  return (
    <Autocomplete
      id={id}
      label={label}
      value={value}
      onChange={onChange}
      options={options}
      placeholder="Ketik untuk mencari siklus tanam"
      emptyOption={{ value: '', label: '— Pilih siklus —' }}
      noMatchLabel="Tidak ada siklus yang cocok"
      required
      maxResults={50}
    />
  );
}
