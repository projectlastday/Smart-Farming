import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Autocomplete } from '@/components/Autocomplete';
import { rankAutocompleteOptions } from '@/lib/autocomplete';
import { useState } from 'react';

const OPTIONS = [
  { value: 'demak', label: 'Demak' },
  { value: 'kudus', label: 'Kudus' },
  { value: 'pati', label: 'Pati' },
];

function Harness({ allowCustom = false }: { allowCustom?: boolean }) {
  const [value, setValue] = useState('');
  return (
    <div>
      <Autocomplete
        id="demo-filter"
        label="Filter lokasi"
        value={value}
        onChange={setValue}
        options={OPTIONS}
        emptyOption={{ value: '', label: 'Semua lokasi' }}
        allowCustom={allowCustom}
      />
      <span data-testid="committed">{value || '(empty)'}</span>
      <button type="button">Di luar</button>
    </div>
  );
}

describe('rankAutocompleteOptions', () => {
  it('ranks closest matches first', () => {
    const ranked = rankAutocompleteOptions(OPTIONS, 'ku');
    expect(ranked.map((option) => option.label)).toEqual(['Kudus']);
  });

  it('keeps prefix matches ahead of contains matches', () => {
    const ranked = rankAutocompleteOptions(
      [
        { value: 'a', label: 'Sawah Utara' },
        { value: 'b', label: 'Utara Sawah' },
      ],
      'utara',
    );
    expect(ranked[0].label).toBe('Utara Sawah');
  });
});

describe('Autocomplete', () => {
  it('filters suggestions as the user types and selects with mouse', () => {
    render(<Harness />);
    const input = screen.getByRole('combobox', { name: 'Filter lokasi' });
    fireEvent.focus(input);
    expect(screen.getByRole('option', { name: 'Semua lokasi' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Demak' })).toBeInTheDocument();
    expect(screen.getByRole('listbox', { name: 'Saran Filter lokasi' })).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'dem' } });
    expect(screen.getByRole('option', { name: 'Demak' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Kudus' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: 'Demak' }));
    expect(screen.getByTestId('committed')).toHaveTextContent('demak');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('shows all options again after a value is committed', () => {
    render(<Harness />);
    const input = screen.getByRole('combobox', { name: 'Filter lokasi' });
    fireEvent.focus(input);
    fireEvent.click(screen.getByRole('option', { name: 'Demak' }));
    fireEvent.focus(input);
    expect(screen.getByRole('option', { name: 'Kudus' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Pati' })).toBeInTheDocument();
  });

  it('supports keyboard navigation, enter, and escape', () => {
    render(<Harness />);
    const input = screen.getByRole('combobox', { name: 'Filter lokasi' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'ku' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByTestId('committed')).toHaveTextContent('kudus');

    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes on click-away and shows no-match state', () => {
    render(<Harness />);
    const input = screen.getByRole('combobox', { name: 'Filter lokasi' });
    fireEvent.focus(input);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Di luar' }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'zzz-tidak-ada' } });
    expect(screen.getByText('Tidak ada data yang cocok')).toBeInTheDocument();
    expect(within(screen.getByRole('listbox')).queryByRole('option')).not.toBeInTheDocument();
  });

  it('does not commit unmatched text when custom values are disallowed', () => {
    render(<Harness />);
    const input = screen.getByRole('combobox', { name: 'Filter lokasi' });
    fireEvent.change(input, { target: { value: 'zzz-tidak-ada' } });
    expect(screen.getByTestId('committed')).toHaveTextContent('(empty)');
  });

  it('clears the value with the clear button', () => {
    render(<Harness />);
    const input = screen.getByRole('combobox', { name: 'Filter lokasi' });
    fireEvent.change(input, { target: { value: 'Kudus' } });
    expect(screen.getByTestId('committed')).toHaveTextContent('kudus');
    fireEvent.click(screen.getByRole('button', { name: 'Hapus Filter lokasi' }));
    expect(screen.getByTestId('committed')).toHaveTextContent('(empty)');
  });
});
