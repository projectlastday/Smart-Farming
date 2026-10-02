import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog, SuccessBanner } from '@/components/ConfirmDialog';

describe('ConfirmDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <ConfirmDialog
        open={false}
        title="Hapus?"
        message="Yakin?"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows accessible dialog with confirm and cancel actions', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Hapus lahan?"
        message="Tindakan tidak dapat dibatalkan."
        confirmLabel="Ya, Hapus"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hapus lahan?' })).toBeInTheDocument();
    expect(screen.getByText('Tindakan tidak dapat dibatalkan.')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Ya, Hapus' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('disables actions while pending', () => {
    render(
      <ConfirmDialog
        open
        title="Hapus?"
        message="Yakin?"
        onConfirm={() => {}}
        onCancel={() => {}}
        isPending
      />,
    );

    expect(screen.getByRole('button', { name: 'Batal' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Hapus' })).toBeDisabled();
  });

  it('moves keyboard focus into the dialog and restores it on close', () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Buka konfirmasi
          </button>
          <ConfirmDialog
            open={open}
            title="Hapus?"
            message="Yakin?"
            onConfirm={() => setOpen(false)}
            onCancel={() => setOpen(false)}
          />
        </>
      );
    }

    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Buka konfirmasi' });
    trigger.focus();
    expect(trigger).toHaveFocus();
    fireEvent.click(trigger);
    expect(screen.getByRole('button', { name: 'Batal' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(trigger).toHaveFocus();
  });
});

describe('SuccessBanner', () => {
  it('shows status message when provided', () => {
    render(<SuccessBanner message="Lahan berhasil dihapus." />);
    expect(screen.getByRole('status')).toHaveTextContent('Lahan berhasil dihapus.');
  });

  it('renders nothing without message', () => {
    const { container } = render(<SuccessBanner message={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
