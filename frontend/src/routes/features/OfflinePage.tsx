import { FormEvent, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CropCycleSelect } from '@/components/CropCycleSelect';
import { LimitationsPanel } from '@/components/LimitationsPanel';
import {
  getInstalledModel,
  installModel,
  isModelInstalled,
  runOfflineDiseaseInference,
  type InstallProgress,
} from '@/offline/model';
import {
  enqueuePrediction,
  generateClientOperationId,
  listQueue,
  queueStats,
} from '@/offline/queue';
import { syncOfflineQueue } from '@/offline/sync';
import { featureTypeLabel, queueStatusLabel } from '@/lib/display';
import { usePrefillCycleId } from '@/hooks/usePrefillCycleId';
import { listCropCycles } from '@/services/farms';

export function OfflinePage() {
  const qc = useQueryClient();
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState<InstallProgress | null>(null);
  const [installError, setInstallError] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const [cycleId, setCycleId] = usePrefillCycleId();
  const [image, setImage] = useState<File | null>(null);
  const [offlineResult, setOfflineResult] = useState<{
    label: string;
    confidence: number;
  } | null>(null);
  const [inferError, setInferError] = useState('');
  const [inferring, setInferring] = useState(false);

  const installedQuery = useQuery({
    queryKey: ['offline-model'],
    queryFn: getInstalledModel,
  });

  const queueQuery = useQuery({
    queryKey: ['offline-queue'],
    queryFn: listQueue,
    refetchInterval: 15_000,
  });

  const statsQuery = useQuery({
    queryKey: ['queue-stats'],
    queryFn: queueStats,
  });

  const cyclesQuery = useQuery({ queryKey: ['crop-cycles'], queryFn: listCropCycles });

  const handleInstall = async () => {
    setInstalling(true);
    setInstallError('');
    try {
      await installModel(setProgress);
      await qc.invalidateQueries({ queryKey: ['offline-model'] });
    } catch (err) {
      setInstallError(err instanceof Error ? err.message : 'Instalasi gagal');
    } finally {
      setInstalling(false);
    }
  };

  const handleSync = async () => {
    setSyncMessage('Menyinkronkan...');
    const result = await syncOfflineQueue();
    if (result.needsLogin) {
      setSyncMessage('Sesi habis — silakan login ulang, antrian tetap aman.');
    } else {
      setSyncMessage(`Selesai: ${result.synced} tersinkron, ${result.failed} gagal.`);
    }
    await qc.invalidateQueries({ queryKey: ['offline-queue'] });
    await qc.invalidateQueries({ queryKey: ['queue-stats'] });
    await qc.invalidateQueries({ queryKey: ['predictions'] });
  };

  const handleOfflineInfer = async (e: FormEvent) => {
    e.preventDefault();
    if (!image || !cycleId) return;
    setInferring(true);
    setInferError('');
    setOfflineResult(null);

    try {
      const installed = await isModelInstalled();
      if (!installed) {
        throw new Error('Instal model offline terlebih dahulu');
      }

      const inference = await runOfflineDiseaseInference(image);
      const classified = inference.label !== 'Tidak dapat diklasifikasi dengan andal';
      const confidencePct = classified ? Math.round(inference.confidence * 10000) / 100 : null;
      setOfflineResult({ label: inference.label, confidence: inference.confidence });

      const cycle = (cyclesQuery.data ?? []).find((c) => c.id === cycleId);
      if (!cycle) throw new Error('Siklus tidak ditemukan');

      await enqueuePrediction({
        client_operation_id: generateClientOperationId(),
        farm_id: cycle.farm_id,
        crop_cycle_id: cycleId,
        feature_type: 'disease',
        model_version: (await getInstalledModel())?.version ?? 'offline-onnx',
        inputs_snapshot: { mode: 'offline', filename: image.name },
        output: {
          status: classified ? 'classified' : 'unknown',
          label: inference.label,
          probabilities: inference.probabilities,
          reliability: {
            kind: 'model_probability',
            label: 'Probabilitas model',
            score: confidencePct,
          },
        },
        confidence: confidencePct,
        assumptions: 'Inferensi offline di browser dengan ONNX Runtime WASM, tanpa unggah gambar.',
        explanation: `Klasifikasi offline: ${inference.label}`,
        recommendation: 'Verifikasi dengan ahli pertanian setempat. Bukan diagnosis lapangan.',
      });

      await qc.invalidateQueries({ queryKey: ['offline-queue'] });
      await qc.invalidateQueries({ queryKey: ['queue-stats'] });
    } catch (err) {
      setInferError(err instanceof Error ? err.message : 'Inferensi gagal');
    } finally {
      setInferring(false);
    }
  };

  const meta = installedQuery.data;
  const stats = statsQuery.data;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>AI Offline & Sinkronisasi</h1>
          <p>Unduh model ONNX dan diagnosis tanpa koneksi internet</p>
        </div>
      </div>

      <div className="card">
        <h3>Status Model</h3>
        {meta ? (
          <div className="alert alert-success">
            Model v{meta.version} terinstal —{' '}
            {(meta.sizeBytes / (1024 * 1024)).toFixed(1)} MB —{' '}
            {new Date(meta.installedAt).toLocaleString('id-ID')}
          </div>
        ) : (
          <div className="alert alert-warning">Model belum diinstal. Aktifkan AI offline di bawah.</div>
        )}

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleInstall}
          disabled={installing}
        >
          {installing ? 'Mengunduh...' : meta ? 'Perbarui Model' : 'Aktifkan AI Offline'}
        </button>

        {progress && (
          <div style={{ marginTop: '1rem' }} role="status" aria-live="polite">
            <p>{progress.message}</p>
            <div className="progress-bar">
              <div className="progress-bar-fill" style={{ width: `${progress.percent}%` }} />
            </div>
          </div>
        )}
        {installError && <div className="alert alert-error">{installError}</div>}
      </div>

      <div className="card">
        <h3>Antrian Sinkronisasi</h3>
        <p>
          Menunggu: {stats?.pending ?? 0} | Gagal: {stats?.failed ?? 0} | Tersinkron:{' '}
          {stats?.synced ?? 0}
        </p>
        <button type="button" className="btn btn-secondary" onClick={handleSync}>
          Sinkronkan Sekarang
        </button>
        {syncMessage && <div className="alert alert-info">{syncMessage}</div>}
        {(queueQuery.data ?? []).length === 0 && (
          <p className="empty-state">Antrian offline kosong. Hasil diagnosis lokal akan muncul di sini.</p>
        )}

        {(queueQuery.data ?? []).length > 0 && (
          <div className="table-scroll" role="region" aria-label="Antrian sinkronisasi" tabIndex={0}>
          <table className="data-table" style={{ marginTop: '1rem' }}>
            <thead>
              <tr>
                <th>Operasi</th>
                <th>Fitur</th>
                <th>Status</th>
                <th>Waktu</th>
              </tr>
            </thead>
            <tbody>
              {(queueQuery.data ?? []).map((item) => (
                <tr key={item.id ?? item.client_operation_id}>
                  <td className="mono-wrap" data-label="Operasi">
                    {item.client_operation_id.slice(0, 8)}…
                  </td>
                  <td data-label="Fitur">{featureTypeLabel(item.payload.feature_type)}</td>
                  <td data-label="Status">
                    <span className="badge">{queueStatusLabel(item.status)}</span>
                    {item.error ? (
                      <span className="muted" title={item.error}>
                        {' '}
                        {item.error}
                      </span>
                    ) : null}
                  </td>
                  <td data-label="Waktu">{new Date(item.created_at).toLocaleString('id-ID')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Diagnosis Offline (Tanpa Upload)</h3>
        <form onSubmit={handleOfflineInfer}>
          <CropCycleSelect value={cycleId} onChange={setCycleId} filterCrop="rice" />
          <div className="form-group">
            <label htmlFor="offline-image">Foto Daun</label>
            <input
              id="offline-image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
              onChange={(e) => setImage(e.target.files?.[0] ?? null)}
            />
          </div>
          {inferError && <div className="alert alert-error">{inferError}</div>}
          {offlineResult && (
            <div className="alert alert-success">
              Hasil: <strong>{offlineResult.label}</strong> (
              {(offlineResult.confidence <= 1
                ? offlineResult.confidence * 100
                : offlineResult.confidence
              ).toFixed(1)}%) — disimpan ke antrian lokal
            </div>
          )}
          <button type="submit" className="btn btn-primary" disabled={inferring || !meta}>
            {inferring ? 'Mendiagnosis...' : 'Diagnosis Offline'}
          </button>
        </form>
      </div>

      <LimitationsPanel>
        <p>
          Inferensi offline menggunakan ONNX Runtime Web (WASM). Gambar tidak diunggah ke server.
          Hasil disimpan di IndexedDB dan disinkronkan saat online dengan ID operasi unik untuk
          exactly-once sync. Kata sandi dan token sesi tidak pernah disimpan lokal.
        </p>
      </LimitationsPanel>
    </>
  );
}
