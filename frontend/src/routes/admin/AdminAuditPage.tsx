import { useQuery } from '@tanstack/react-query';
import { apiFetch, ApiClientError } from '@/services/api';

interface AuditRow {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  timestamp: string;
}

const ACTION_LABELS: Record<string, string> = {
  'admin.created': 'Akun admin dibuat',
  'farmer.created': 'Akun petani dibuat',
  'user.disable': 'Akun dinonaktifkan',
  'user.enable': 'Akun diaktifkan',
  'user.anonymize': 'Akun dianonimkan',
};

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replaceAll('.', ' ');
}

function safeMetadata(metadata: Record<string, unknown> | null): string {
  if (!metadata) return '—';
  const filtered = Object.fromEntries(
    Object.entries(metadata).filter(([key]) => {
      const lower = key.toLowerCase();
      return !lower.includes('token') && !lower.includes('password') && !lower.includes('secret');
    }),
  );
  const keys = Object.keys(filtered);
  if (keys.length === 0) return '—';
  return keys
    .map((key) => `${key}: ${String(filtered[key])}`)
    .join(', ');
}

export function AdminAuditPage() {
  const query = useQuery({
    queryKey: ['admin-audit'],
    queryFn: () => apiFetch<AuditRow[]>('/admin/audit'),
  });

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Log Audit</h1>
      <p>Catatan aksi akun sensitif. Kata sandi tidak ditampilkan.</p>
        </div>
      </div>

      {query.isError ? (
        <div className="alert alert-error" role="alert">
          {query.error instanceof ApiClientError ? query.error.message : 'Gagal memuat log audit.'}{' '}
          <button type="button" className="btn btn-secondary" onClick={() => void query.refetch()}>
            Coba lagi
          </button>
        </div>
      ) : query.isLoading ? (
        <p>Memuat log audit…</p>
      ) : (query.data ?? []).length === 0 ? (
        <p className="empty-state">Belum ada entri audit.</p>
      ) : (
        <div className="card table-card">
          <div className="table-scroll" role="region" aria-label="Log audit" tabIndex={0}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Aksi</th>
                  <th>Target</th>
                  <th>Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {(query.data ?? []).map((row) => (
                  <tr key={row.id}>
                    <td data-label="Waktu">{new Date(row.timestamp).toLocaleString('id-ID')}</td>
                    <td data-label="Aksi">{actionLabel(row.action)}</td>
                    <td data-label="Target">
                      {row.target_type ?? '—'}
                      {row.target_id ? ` / ${row.target_id.slice(0, 8)}` : ''}
                    </td>
                    <td data-label="Keterangan">{safeMetadata(row.metadata)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
