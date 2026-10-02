import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CropCycleSelect } from '@/components/CropCycleSelect';
import * as farmsService from '@/services/farms';

vi.mock('@/services/farms');

const cycles = [
  {
    id: 'rice-1',
    farm_id: 'farm-1',
    crop: 'rice',
    variety: 'Ciherang',
    planting_date: '2026-03-01',
    area: 1,
    location: 'Blok A',
    lifecycle_status: 'growing',
  },
  {
    id: 'rice-2',
    farm_id: 'farm-1',
    crop: 'rice',
    variety: 'IR64',
    planting_date: '2026-04-15',
    area: 2,
    location: 'Blok B',
    lifecycle_status: 'planted',
  },
  {
    id: 'guava-1',
    farm_id: 'farm-1',
    crop: 'guava',
    variety: 'Kristal',
    planting_date: '2010-01-01',
    area: 1,
    location: 'Kebun',
    lifecycle_status: 'growing',
  },
];

function renderSelect(filterCrop?: string) {
  const onChange = vi.fn();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <CropCycleSelect value="" onChange={onChange} filterCrop={filterCrop} />
    </QueryClientProvider>,
  );
  return onChange;
}

describe('CropCycleSelect autocomplete', () => {
  beforeEach(() => {
    vi.mocked(farmsService.listCropCycles).mockResolvedValue(cycles);
  });

  it('keeps only rice aliases when scoped to rice, even if crop is Padi or Rice', async () => {
    vi.mocked(farmsService.listCropCycles).mockResolvedValue([
      { ...cycles[0], crop: 'Padi' },
      { ...cycles[1], crop: 'Rice' },
      cycles[2],
    ]);
    renderSelect('rice');
    const input = await screen.findByRole('combobox', { name: 'Siklus Tanam' });
    fireEvent.focus(input);
    expect(screen.getByRole('option', { name: /Ciherang/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /IR64/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Kristal/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Jambu/ })).not.toBeInTheDocument();
  });

  it('filters rice cycles by typed search and selects a match', async () => {
    const onChange = renderSelect('rice');
    const input = await screen.findByRole('combobox', { name: 'Siklus Tanam' });
    fireEvent.focus(input);
    expect(screen.getByRole('option', { name: /Ciherang/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Kristal/ })).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'ir64' } });
    expect(screen.getByRole('option', { name: /IR64/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Ciherang/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: /IR64/ }));
    expect(onChange).toHaveBeenCalledWith('rice-2');
  });

  it('keeps guava cycles only when scoped to guava', async () => {
    renderSelect('guava');
    const input = await screen.findByRole('combobox', { name: 'Siklus Tanam' });
    fireEvent.focus(input);
    expect(screen.getByRole('option', { name: /Kristal/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Ciherang/ })).not.toBeInTheDocument();
  });

  it('shows no-match copy and does not commit invalid cycle ids', async () => {
    const onChange = renderSelect('rice');
    const input = await screen.findByRole('combobox', { name: 'Siklus Tanam' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'zzz-tidak-ada' } });
    expect(screen.getByText('Tidak ada siklus yang cocok')).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('clears a cycle that does not match the crop filter', async () => {
    const onChange = vi.fn();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <CropCycleSelect value="guava-1" onChange={onChange} filterCrop="rice" />
      </QueryClientProvider>,
    );
    await screen.findByRole('combobox', { name: 'Siklus Tanam' });
    expect(onChange).toHaveBeenCalledWith('');
  });
});
