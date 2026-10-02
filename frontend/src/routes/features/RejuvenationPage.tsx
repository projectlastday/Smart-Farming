import { FormEvent, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { runRejuvenation } from '@/services/features';
import { CropCycleSelect } from '@/components/CropCycleSelect';
import { PredictionResult } from '@/components/PredictionResult';
import { LimitationsPanel } from '@/components/LimitationsPanel';
import { usePrefillCycleId } from '@/hooks/usePrefillCycleId';
import type { Prediction } from '@/types';
import { ApiClientError } from '@/services/api';

export function RejuvenationPage() {
  const [cycleId, setCycleId] = usePrefillCycleId();
  const [orchardAge, setOrchardAge] = useState('12');
  const [decline, setDecline] = useState('moderate');
  const [canopy, setCanopy] = useState('sparse');
  const [result, setResult] = useState<Prediction | null>(null);
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      runRejuvenation({
        crop_cycle_id: cycleId,
        orchard_age: parseInt(orchardAge, 10),
        productivity_decline: decline,
        canopy_condition: canopy,
      }),
    onSuccess: (data) => {
      setResult(data);
      setError('');
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiClientError ? err.message : 'Analisis gagal');
      setResult(null);
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Rejuvenasi Kebun Jambu</h1>
          <p>Rekomendasi evaluasi rejuvenasi kebun jambu biji tua</p>
        </div>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <CropCycleSelect value={cycleId} onChange={setCycleId} filterCrop="guava" />
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="age">Usia Kebun (tahun)</label>
              <input id="age" type="number" min="1" value={orchardAge} onChange={(e) => setOrchardAge(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="decline">Penurunan Produktivitas</label>
              <select id="decline" value={decline} onChange={(e) => setDecline(e.target.value)}>
                <option value="none">Tidak ada</option>
                <option value="mild">Ringan</option>
                <option value="moderate">Sedang</option>
                <option value="severe">Berat</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="canopy">Kondisi Tajuk</label>
            <select id="canopy" value={canopy} onChange={(e) => setCanopy(e.target.value)}>
              <option value="healthy">Sehat</option>
              <option value="moderate">Sedang</option>
              <option value="sparse">Jarang/Rusak</option>
              <option value="dead">Banyak mati</option>
            </select>
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          <button type="submit" className="btn btn-primary" disabled={!cycleId || mutation.isPending}>
            {mutation.isPending ? 'Menganalisis...' : 'Evaluasi Rejuvenasi'}
          </button>
        </form>
      </div>

      {result && <PredictionResult prediction={result} />}

      <LimitationsPanel>
        <p>
          Rekomendasi berbasis aturan deterministik khusus jambu biji, bukan deep learning.
          Usia 10–20 tahun sering menjadi pertimbangan, tetapi keputusan pruning bergantung kondisi
          aktual dan praktik lokal. Konsultasikan ahli setempat sebelum tindakan irreversible.
        </p>
        <p>Hanya berlaku untuk siklus tanam <strong>jambu biji</strong>. Padi: Tidak Berlaku.</p>
      </LimitationsPanel>
    </>
  );
}
