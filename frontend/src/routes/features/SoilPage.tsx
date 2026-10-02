import { FormEvent, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { runSoil } from '@/services/features';
import { CropCycleSelect } from '@/components/CropCycleSelect';
import { PredictionResult } from '@/components/PredictionResult';
import { LimitationsPanel } from '@/components/LimitationsPanel';
import { usePrefillCycleId } from '@/hooks/usePrefillCycleId';
import type { Prediction } from '@/types';
import { ApiClientError } from '@/services/api';

export function SoilPage() {
  const [cycleId, setCycleId] = usePrefillCycleId();
  const [ph, setPh] = useState('6.5');
  const [moisture, setMoisture] = useState('45');
  const [nitrogen, setNitrogen] = useState('30');
  const [phosphorus, setPhosphorus] = useState('15');
  const [potassium, setPotassium] = useState('120');
  const [provenance, setProvenance] = useState('manual');
  const [result, setResult] = useState<Prediction | null>(null);
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      runSoil({
        crop_cycle_id: cycleId,
        ph: parseFloat(ph),
        moisture: parseFloat(moisture),
        nitrogen: parseFloat(nitrogen),
        phosphorus: parseFloat(phosphorus),
        potassium: parseFloat(potassium),
        input_provenance: provenance,
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
          <h1>Analisis Kondisi Tanah</h1>
          <p>Penilaian kondisi tanah dan panduan nitrogen</p>
        </div>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <CropCycleSelect value={cycleId} onChange={setCycleId} />
          <div className="form-group">
            <label htmlFor="provenance">Sumber Data Input</label>
            <select id="provenance" value={provenance} onChange={(e) => setProvenance(e.target.value)}>
              <option value="manual">Input Manual</option>
              <option value="measured">Diukur di Lab</option>
              <option value="simulated">Simulasi Sensor</option>
              <option value="location">Konteks Lokasi (SoilGrids)</option>
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="ph">pH</label>
              <input id="ph" type="number" step="0.1" value={ph} onChange={(e) => setPh(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="moisture">Kelembaban (%)</label>
              <input id="moisture" type="number" value={moisture} onChange={(e) => setMoisture(e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="nitrogen">Nitrogen (mg/kg)</label>
              <input id="nitrogen" type="number" value={nitrogen} onChange={(e) => setNitrogen(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="phosphorus">Fosfor (mg/kg)</label>
              <input id="phosphorus" type="number" value={phosphorus} onChange={(e) => setPhosphorus(e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="potassium">Kalium (mg/kg)</label>
            <input id="potassium" type="number" value={potassium} onChange={(e) => setPotassium(e.target.value)} />
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          <button type="submit" className="btn btn-primary" disabled={!cycleId || mutation.isPending}>
            {mutation.isPending ? 'Menganalisis...' : 'Analisis Tanah'}
          </button>
        </form>
      </div>

      {result && <PredictionResult prediction={result} />}

      <LimitationsPanel>
        <p>
          Nilai SoilGrids adalah konteks regional, bukan pengukuran laboratorium. Simulasi sensor
          ditandai secara eksplisit dan tidak menggantikan uji tanah basah (wet chemistry).
          Panduan nitrogen bersifat indikatif — verifikasi keputusan penting dengan uji tanah
          profesional.
        </p>
      </LimitationsPanel>
    </>
  );
}
