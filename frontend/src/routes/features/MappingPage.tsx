import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { runMapping } from '@/services/features';
import { CropCycleSelect } from '@/components/CropCycleSelect';
import { PredictionResult } from '@/components/PredictionResult';
import { LimitationsPanel } from '@/components/LimitationsPanel';
import { usePrefillCycleId } from '@/hooks/usePrefillCycleId';
import type { Prediction } from '@/types';
import { ApiClientError } from '@/services/api';

export function MappingPage() {
  const [cycleId, setCycleId] = usePrefillCycleId();
  const [useFixture, setUseFixture] = useState(true);
  const [result, setResult] = useState<Prediction | null>(null);
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => runMapping(cycleId, useFixture),
    onSuccess: (data) => {
      setResult(data);
      setError('');
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiClientError ? err.message : 'Pemetaan gagal');
      setResult(null);
    },
  });

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Pemetaan Lahan</h1>
          <p>Segmentasi lahan dari citra Sentinel-2 (demo)</p>
        </div>
      </div>

      <div className="card">
        <CropCycleSelect value={cycleId} onChange={setCycleId} filterCrop="rice" />
        <div className="form-group">
          <label className="form-check" htmlFor="use-mapping-fixture">
            <input
              id="use-mapping-fixture"
              type="checkbox"
              checked={useFixture}
              onChange={(e) => setUseFixture(e.target.checked)}
            />
            <span>Gunakan citra demo (fixture) — disarankan untuk demonstrasi sekolah</span>
          </label>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <button
          type="button"
          className="btn btn-primary"
          disabled={!cycleId || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? 'Memproses...' : 'Proses Pemetaan'}
        </button>
      </div>

      {result && <PredictionResult prediction={result} />}

      <LimitationsPanel>
        <p>
          Resolusi Sentinel-2 10 m dan fragmentasi lahan kecil membatasi akurasi batas parcel.
          Citra demo tidak menggantikan survei lapangan. Copernicus STAC live download bukan
          dependensi v1.
        </p>
      </LimitationsPanel>
    </>
  );
}
