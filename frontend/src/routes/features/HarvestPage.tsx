import { useState } from 'react';
import { usePrefillCycleId } from '@/hooks/usePrefillCycleId';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { runHarvest } from '@/services/features';
import { listCropCycles, markActualHarvest } from '@/services/farms';
import { Autocomplete } from '@/components/Autocomplete';
import { CropCycleSelect } from '@/components/CropCycleSelect';
import { HarvestResultCard } from '@/components/HarvestResultCard';
import { LimitationsPanel } from '@/components/LimitationsPanel';
import { VARIETY_OPTIONS } from '@/types';
import type { Prediction } from '@/types';
import { ApiClientError } from '@/services/api';

export function HarvestPage() {
  const qc = useQueryClient();
  const [cycleId, setCycleId] = usePrefillCycleId();
  const [varietyKey, setVarietyKey] = useState('ciherang');
  const [result, setResult] = useState<Prediction | null>(null);
  const [error, setError] = useState('');
  const [actualDate, setActualDate] = useState('');
  const [actualYield, setActualYield] = useState('');
  const [harvestMessage, setHarvestMessage] = useState('');

  const cyclesQuery = useQuery({ queryKey: ['crop-cycles'], queryFn: listCropCycles });
  const selectedCycle = (cyclesQuery.data ?? []).find((cycle) => cycle.id === cycleId);

  const mutation = useMutation({
    mutationFn: () => runHarvest(cycleId, varietyKey),
    onSuccess: (data) => {
      setResult(data);
      setError('');
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiClientError ? err.message : 'Prediksi gagal');
      setResult(null);
    },
  });

  const harvestMutation = useMutation({
    mutationFn: () =>
      markActualHarvest(cycleId, {
        actual_harvest_date: actualDate,
        actual_yield: actualYield ? Number(actualYield) : null,
        yield_unit: 'kg',
      }),
    onSuccess: async () => {
      setHarvestMessage('Panen aktual tersimpan. Prediksi lama tidak diubah.');
      await qc.invalidateQueries({ queryKey: ['crop-cycles'] });
    },
    onError: (err: unknown) => {
      setHarvestMessage(err instanceof ApiClientError ? err.message : 'Gagal menandai panen');
    },
  });

  const predictedVsActual = result?.output?.predicted_vs_actual as
    | { delta_days_from_window_mid?: number; actual_harvest_date?: string }
    | undefined;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Prediksi Waktu Panen Padi</h1>
          <p>Perkiraan tanggal panen berdasarkan fenologi dan durasi varietas</p>
        </div>
      </div>

      <div className="card">
        <CropCycleSelect value={cycleId} onChange={setCycleId} filterCrop="rice" />
        <Autocomplete
          id="variety"
          label="Varietas Padi"
          value={varietyKey}
          onChange={setVarietyKey}
          options={VARIETY_OPTIONS}
          placeholder="Ketik untuk mencari varietas"
          noMatchLabel="Tidak ada varietas yang cocok"
          required
        />
        {error && <div className="alert alert-error">{error}</div>}
        <button
          type="button"
          className="btn btn-primary"
          disabled={!cycleId || !varietyKey || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? 'Menghitung...' : 'Prediksi Panen'}
        </button>
      </div>

      {result && <HarvestResultCard prediction={result} />}
      {predictedVsActual?.actual_harvest_date && (
        <p className="alert alert-info" role="status">
          Panen aktual {predictedVsActual.actual_harvest_date}. Selisih terhadap tengah jendela
          prediksi: {predictedVsActual.delta_days_from_window_mid} hari.
        </p>
      )}

      <div className="card">
        <h2>Tandai Panen</h2>
        <p className="harvest-helper">
          Mencatat tanggal panen aktual tidak mengubah prediksi yang sudah tersimpan.
        </p>
        {selectedCycle?.actual_harvest_date && (
          <p>
            Panen aktual tersimpan: {selectedCycle.actual_harvest_date}
            {selectedCycle.actual_yield != null
              ? ` — ${selectedCycle.actual_yield} ${selectedCycle.yield_unit ?? 'kg'}`
              : ''}
          </p>
        )}
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="actual-harvest-date">Tanggal panen aktual</label>
            <input
              id="actual-harvest-date"
              type="date"
              value={actualDate}
              onChange={(event) => setActualDate(event.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="actual-yield">Hasil (kg, opsional)</label>
            <input
              id="actual-yield"
              type="number"
              min="0"
              step="0.1"
              value={actualYield}
              onChange={(event) => setActualYield(event.target.value)}
            />
          </div>
        </div>
        {harvestMessage && <p className="alert alert-info">{harvestMessage}</p>}
        <button
          type="button"
          className="btn btn-secondary"
          disabled={!cycleId || !actualDate || harvestMutation.isPending}
          onClick={() => harvestMutation.mutate()}
        >
          {harvestMutation.isPending ? 'Menyimpan...' : 'Tandai Panen'}
        </button>
      </div>

      <LimitationsPanel>
        <p>
          Estimasi berdasarkan durasi varietas (Ciherang, IR64, Inpari 32) sebagai prior
          transparan, bukan kalibrasi lokal. Perbedaan praktik tanam, cuaca, dan varietas
          dapat menyebabkan deviasi signifikan. Data cuaca NASA POWER opsional dan mungkin tidak
          tersedia.
        </p>
        <p>Fitur ini hanya berlaku untuk siklus tanam <strong>padi</strong>.</p>
      </LimitationsPanel>
    </>
  );
}
