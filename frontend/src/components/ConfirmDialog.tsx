import { useEffect, useRef, type ReactNode } from 'react';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending?: boolean;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Hapus',
  cancelLabel = 'Batal',
  onConfirm,
  onCancel,
  isPending = false,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cancelRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isPending) onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, isPending, onCancel]);

  if (!open) return null;

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="confirm-dialog-title">{title}</h2>
        <p id="confirm-dialog-message">{message}</p>
        <div className="dialog-actions">
          <button
            ref={cancelRef}
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={isPending}
          >
            {cancelLabel}
          </button>
          <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={isPending}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SuccessBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="alert alert-success" role="status">
      {message}
    </div>
  );
}

export function RowActions({ children }: { children: ReactNode }) {
  return <div className="table-actions">{children}</div>;
}
