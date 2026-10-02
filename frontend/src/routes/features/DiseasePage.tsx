import { FormEvent, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { runDisease } from '@/services/features';
import { CropCycleSelect } from '@/components/CropCycleSelect';
import { PredictionResult } from '@/components/PredictionResult';
import { LimitationsPanel } from '@/components/LimitationsPanel';
import { usePrefillCycleId } from '@/hooks/usePrefillCycleId';
import type { Prediction } from '@/types';
import { ApiClientError } from '@/services/api';

export function DiseasePage() {
  const [cycleId, setCycleId] = usePrefillCycleId();
  const [image, setImage] = useState<File | null>(null);
  const [saveImage, setSaveImage] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<Prediction | null>(null);
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => {
      if (!image) throw new Error('Pilih gambar');
      return runDisease(cycleId, image, saveImage);
    },
    onSuccess: (data) => {
      setResult(data);
      setError('');
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiClientError ? err.message : 'Diagnosis gagal');
      setResult(null);
    },
  });

  const handleFile = (file: File | null) => {
    setImage(file);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(file ? URL.createObjectURL(file) : null);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Diagnosis Penyakit Daun Padi</h1>
          <p>Klasifikasi kondisi daun padi dari foto (online)</p>
        </div>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <CropCycleSelect value={cycleId} onChange={setCycleId} filterCrop="rice" />
          <div className="form-group">
            <label htmlFor="leaf-image">Foto Daun (JPEG/PNG/WebP, max 10 MB)</label>
            <input
              id="leaf-image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
          </div>
          {preview && (
            <img
              src={preview}
              alt="Pratinjau daun"
              style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 'var(--radius)' }}
            />
          )}
          <div className="form-group">
            <label className="form-check" htmlFor="save-leaf-image">
              <input
                id="save-leaf-image"
                type="checkbox"
                checked={saveImage}
                onChange={(e) => setSaveImage(e.target.checked)}
              />
              <span>Simpan gambar (opt-in, disimpan terpisah dan aman)</span>
            </label>
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          <button type="submit" className="btn btn-primary" disabled={!cycleId || !image || mutation.isPending}>
            {mutation.isPending ? 'Mendiagnosis...' : 'Diagnosis Online'}
          </button>
        </form>
      </div>

      {result && <PredictionResult prediction={result} />}

      <LimitationsPanel>
        <p>
          Model v1 adalah MobileNetV3-Small yang dilatih pada subset foto daun padi nyata Paddy
          Doctor (bukan gambar sintetis). Hasil bukan diagnosis agronom definitif. Untuk diagnosis
          tanpa unggah gambar, gunakan fitur AI Offline.
        </p>
        <p>Hanya berlaku untuk siklus tanam <strong>padi</strong>.</p>
      </LimitationsPanel>
    </>
  );
}
