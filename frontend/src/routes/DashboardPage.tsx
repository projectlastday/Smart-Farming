import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { listFarms, listCropCycles } from '@/services/farms';
import { listPredictions } from '@/services/predictions';
import { queueStats } from '@/offline/queue';
import { FEATURE_LABELS } from '@/types';
import { LoadingSpinner } from '@/components/LoadingSpinner';

const FEATURES = [
  { path: '/features/harvest', key: 'harvest', desc: 'Kapan padi siap dipanen?', crop: 'Padi' },
  { path: '/features/soil', key: 'soil', desc: 'Apakah kondisi tanah mendukung?', crop: 'Padi & jambu' },
  { path: '/features/disease', key: 'disease', desc: 'Periksa foto daun padi', crop: 'Padi' },
  { path: '/features/rejuvenation', key: 'rejuvenation', desc: 'Evaluasi kondisi kebun tua', crop: 'Jambu' },
  { path: '/features/offline', key: 'offline', desc: 'Gunakan AI saat tanpa internet', crop: 'Lapangan' },
];

export function DashboardPage() {
  const { user } = useAuth();

  const farmsQuery = useQuery({ queryKey: ['farms'], queryFn: listFarms, retry: 1 });
  const cyclesQuery = useQuery({ queryKey: ['crop-cycles'], queryFn: listCropCycles, retry: 1 });
  const predictionsQuery = useQuery({
    queryKey: ['predictions', 'dashboard'],
    queryFn: () => listPredictions({ page: 1, pageSize: 5 }),
    retry: 1,
  });
  const queueQuery = useQuery({ queryKey: ['queue-stats'], queryFn: queueStats, refetchInterval: 30_000 });

  const activeCycles = (cyclesQuery.data ?? []).filter(
    (c) => !['harvested', 'archived'].includes(c.lifecycle_status),
  );
  const recentPredictions = predictionsQuery.data?.items ?? [];
  const queue = queueQuery.data;
  const farms = farmsQuery.data ?? [];
  const farmById = new Map(farms.map((farm) => [farm.id, farm]));
  const firstCycle = activeCycles[0];
  const dataError = farmsQuery.isError || cyclesQuery.isError;
  const dataLoading = (farmsQuery.isLoading || cyclesQuery.isLoading) && !dataError;

  return (
    <>
      {dataLoading && <LoadingSpinner />}

      {dataError && (
        <div className="alert alert-error" role="alert">
          <p>Gagal memuat dasbor.</p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              void farmsQuery.refetch();
              void cyclesQuery.refetch();
            }}
          >
            Coba lagi
          </button>
        </div>
      )}

      {!dataLoading && !dataError && (
        <>
      <section className="dashboard-hero" aria-labelledby="dashboard-title">
        <div>
          <p className="dashboard-eyebrow">Dasbor petani</p>
          <h1 id="dashboard-title">Selamat datang, {user?.name}</h1>
          <p>Lihat semua hasil analisis tersimpan, lalu buka prediksi yang ingin Anda periksa.</p>
        </div>
        <div className="dashboard-hero-actions">
          <Link
            className="btn btn-primary"
            to="/analysis"
          >
            {firstCycle ? 'Buka semua analisis' : 'Lihat analisis'}
          </Link>
          <Link className="btn btn-outline" to="/farms">
            Kelola lahan
          </Link>
        </div>
      </section>

      <section className="dashboard-stats" aria-label="Ringkasan status">
        <Link className="dashboard-stat" to="/farms">
          <span className="dashboard-stat-label">Lahan Aktif</span>
          <strong>{farms.length}</strong>
          <span className="dashboard-stat-action">Lihat semua lahan →</span>
        </Link>
        <Link className="dashboard-stat" to="/crop-cycles">
          <span className="dashboard-stat-label">Siklus Tanam Aktif</span>
          <strong>{activeCycles.length}</strong>
          <span className="dashboard-stat-action">Lihat siklus →</span>
        </Link>
        <Link className="dashboard-stat dashboard-stat-warning" to="/features/offline">
          <span className="dashboard-stat-label">Antrian Offline</span>
          <strong>{(queue?.pending ?? 0) + (queue?.failed ?? 0)}</strong>
          <span className="dashboard-stat-action">
            {(queue?.failed ?? 0) > 0 ? `${queue?.failed} gagal · buka AI offline` : 'Buka AI offline →'}
          </span>
        </Link>
      </section>

      <section className="dashboard-section" aria-labelledby="dashboard-next-title">
        <div className="dashboard-section-heading">
          <div>
            <p className="dashboard-eyebrow">Langkah berikutnya</p>
          <h2 id="dashboard-next-title">Lahan dan siklus tanam aktif</h2>
          </div>
          <Link to="/crop-cycles">Kelola siklus →</Link>
        </div>
        {activeCycles.length === 0 ? (
          <div className="dashboard-empty">
            <p>Belum ada siklus tanam yang berjalan.</p>
            <Link className="btn btn-primary" to="/crop-cycles">
              Tambah siklus tanam
            </Link>
          </div>
        ) : (
          <div className="dashboard-cycle-list">
            {activeCycles.slice(0, 3).map((cycle) => {
              const farm = farmById.get(cycle.farm_id);
              return (
                <article className="dashboard-cycle-card" key={cycle.id}>
                  <div className="dashboard-cycle-info">
                    <span className="badge">{cycle.crop === 'rice' ? 'Padi' : 'Jambu Biji'}</span>
                    <h3>{farm?.name ?? 'Lahan tidak ditemukan'}</h3>
                    <p>
                      {cycle.variety} · {cycle.location || farm?.location || 'Lokasi belum diisi'}
                    </p>
                    <p className="dashboard-cycle-date">Ditanam {cycle.planting_date}</p>
                  </div>
                  <Link className="btn btn-primary" to="/analysis">Buka analisis</Link>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="dashboard-section" aria-labelledby="dashboard-recent-title">
        <div className="dashboard-section-heading">
          <div>
            <p className="dashboard-eyebrow">Jejak keputusan</p>
            <h2 id="dashboard-recent-title">Prediksi Terbaru</h2>
          </div>
          <Link to="/predictions">Buka riwayat lengkap →</Link>
        </div>
        <div className="card dashboard-recent-card">
          {predictionsQuery.isError ? (
            <div className="alert alert-error" role="alert">
              <p>Gagal memuat prediksi tersimpan.</p>
              <button type="button" className="btn btn-secondary" onClick={() => void predictionsQuery.refetch()}>
                Coba lagi
              </button>
            </div>
          ) : recentPredictions.length === 0 ? (
            <p className="empty-state">Belum ada prediksi. Pilih siklus di atas untuk mulai.</p>
          ) : (
            <div className="table-scroll" role="region" aria-label="Prediksi terbaru" tabIndex={0}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fitur</th>
                    <th>Tanggal</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPredictions.map((p) => (
                    <tr key={p.id}>
                      <td data-label="Fitur">{FEATURE_LABELS[p.feature_type] ?? p.feature_type}</td>
                      <td data-label="Tanggal">{new Date(p.created_at).toLocaleString('id-ID')}</td>
                      <td data-label="Detail">
                        <Link className="table-link" to={`/predictions/${p.id}`}>
                          Buka detail
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="dashboard-section" aria-labelledby="dashboard-tools-title">
        <div className="dashboard-section-heading dashboard-section-heading-stacked">
          <div>
            <p className="dashboard-eyebrow">Sesuai kebutuhan Anda</p>
            <h2 id="dashboard-tools-title">Fitur dan alat bantu</h2>
          </div>
          <p>Pilih tindakan langsung jika Anda sudah tahu apa yang ingin diperiksa.</p>
        </div>
        <div className="dashboard-tools">
          {FEATURES.map((f) => (
            <Link key={f.key} to={f.path} className="feature-shortcut dashboard-tool">
              <span className="dashboard-tool-crop">{f.crop}</span>
              <strong>{FEATURE_LABELS[f.key]}</strong>
              <span>{f.desc}</span>
            </Link>
          ))}
        </div>
      </section>
        </>
      )}
    </>
  );
}
