export function LoadingSpinner({ label = 'Memuat...' }: { label?: string }) {
  return (
    <div className="loading-center" role="status" aria-label={label}>
      <div className="spinner" />
    </div>
  );
}
