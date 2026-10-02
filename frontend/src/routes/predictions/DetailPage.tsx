import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getPrediction } from '@/services/predictions';
import { HarvestResultCard } from '@/components/HarvestResultCard';
import { PredictionResult } from '@/components/PredictionResult';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { FEATURE_LABELS } from '@/types';

export function PredictionDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: prediction, isLoading, error } = useQuery({
    queryKey: ['prediction', id],
    queryFn: () => getPrediction(id!),
    enabled: Boolean(id),
  });

  if (isLoading) return <LoadingSpinner />;

  if (error || !prediction) {
    return (
      <div className="alert alert-error" role="alert">
        <p>Prediksi tidak ditemukan.</p>
        <Link className="btn btn-secondary" to="/predictions">
          Kembali ke riwayat
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Detail Prediksi</h1>
          <p>{FEATURE_LABELS[prediction.feature_type] ?? prediction.feature_type}</p>
        </div>
        <Link to="/predictions" className="btn btn-outline">
          ← Riwayat
        </Link>
      </div>

      {prediction.feature_type === 'harvest' ? (
        <HarvestResultCard prediction={prediction} />
      ) : (
        <PredictionResult prediction={prediction} />
      )}

      <details className="card result-details" style={{ marginTop: '1rem' }}>
        <summary>Metadata rekaman</summary>
        <dl>
          <dt>Dibuat</dt>
          <dd>{new Date(prediction.created_at).toLocaleString('id-ID')}</dd>
          <dt>ID prediksi</dt>
          <dd className="mono-wrap">{prediction.id}</dd>
          <dt>ID operasi klien</dt>
          <dd className="mono-wrap">{prediction.client_operation_id}</dd>
        </dl>
        {prediction.provenance && (
          <details>
            <summary>Sumber data eksternal</summary>
            <pre className="result-pre">{JSON.stringify(prediction.provenance, null, 2)}</pre>
          </details>
        )}
      </details>
    </>
  );
}
