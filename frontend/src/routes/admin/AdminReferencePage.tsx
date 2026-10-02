import { useQuery } from '@tanstack/react-query';
import { apiFetch, ApiClientError } from '@/services/api';

interface ReferenceEntry {
  id: number;
  reference_type: string;
  crop: string;
  key_code: string;
  display_value: string;
  scientific_metadata: Record<string, unknown> | null;
}

function typeLabel(value: string): string {
  if (value === 'crop_variety') return 'Varietas';
  if (value === 'disease_class') return 'Kelas penyakit';
  if (value === 'rule_version') return 'Versi aturan';
  return value;
}

function cropLabel(value: string): string {
  if (value === 'rice') return 'Padi';
  if (value === 'guava') return 'Jambu biji';
  return value;
}

export function AdminReferencePage() {
  const query = useQuery({
    queryKey: ['admin-reference'],
    queryFn: () => apiFetch<ReferenceEntry[]>('/admin/reference'),
  });

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Admin — Referensi Pertanian</h1>
          <p>Data referensi dari server (hanya baca pada v1)</p>
        </div>
      </div>

      {query.isError ? (
        <div className="alert alert-error" role="alert">
          {query.error instanceof ApiClientError
            ? query.error.message
            : 'Gagal memuat referensi.'}{' '}
          <button type="button" className="btn btn-secondary" onClick={() => void query.refetch()}>
            Coba lagi
          </button>
        </div>
      ) : null}

      <div className="card">
        <h3>Referensi terkunci (v1)</h3>
        <p className="harvest-helper">
          Daftar ini bersumber dari database, bukan salinan stub di klien. Perubahan hanya melalui
          seed/migrasi.
        </p>
        {query.isLoading ? (
          <p>Memuat referensi…</p>
        ) : (query.data ?? []).length === 0 ? (
          <p className="empty-state">Belum ada entri referensi di server.</p>
        ) : (
          <div className="table-scroll" role="region" aria-label="Referensi pertanian" tabIndex={0}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tipe</th>
                  <th>Tanaman</th>
                  <th>Kode</th>
                  <th>Tampilan</th>
                </tr>
              </thead>
              <tbody>
                {(query.data ?? []).map((row) => (
                  <tr key={row.id}>
                    <td data-label="Tipe">{typeLabel(row.reference_type)}</td>
                    <td data-label="Tanaman">{cropLabel(row.crop)}</td>
                    <td data-label="Kode">{row.key_code}</td>
                    <td data-label="Tampilan">{row.display_value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
