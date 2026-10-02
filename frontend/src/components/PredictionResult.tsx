import type { Prediction } from '@/types';
import { FEATURE_LABELS } from '@/types';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

export function PredictionResult({ prediction }: { prediction: Prediction }) {
  const output = prediction.output ?? {};
  const notApplicable =
    output.not_applicable === true ||
    output.status === 'not_applicable' ||
    String(output.label ?? '').includes('Tidak Berlaku');
  const confidence =
    prediction.confidence != null && Number.isFinite(Number(prediction.confidence))
      ? Math.min(100, Math.max(0, Number(prediction.confidence)))
      : null;
  const reliability = asRecord(output.reliability);
  const reliabilityKind = asString(reliability.kind);
  const reliabilityLabel = asString(reliability.label) ?? 'Keandalan aturan';
  const reliabilityScore =
    typeof reliability.score === 'number' && Number.isFinite(reliability.score)
      ? Number(reliability.score)
      : null;
  const showModelMeter =
    !notApplicable && confidence != null && reliabilityKind === 'model_probability';
  const showRuleReliability =
    !notApplicable && reliabilityKind === 'rule_completeness' && reliabilityScore != null;
  const title = FEATURE_LABELS[prediction.feature_type] ?? prediction.feature_type;
  const labelId = asString(output.label_id) ?? asString(output.label);

  return (
    <article className="card result-block prediction-result" aria-labelledby="prediction-result-title">
      <header className="harvest-result-header">
        <h3 id="prediction-result-title">Hasil: {title}</h3>
        {notApplicable && <span className="badge">Tidak Berlaku</span>}
        {asString(output.status) === 'classified' && labelId && (
          <span className="badge">{labelId}</span>
        )}
      </header>

      {showModelMeter && confidence != null && (
        <div className="harvest-confidence">
          <div className="harvest-confidence-copy">
            <span id={`prediction-confidence-${prediction.id}`}>Probabilitas model</span>
            <strong aria-hidden="true">{confidence.toFixed(1)}%</strong>
          </div>
          <div
            className="progress-bar harvest-confidence-bar"
            role="meter"
            aria-labelledby={`prediction-confidence-${prediction.id}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Number(confidence.toFixed(1))}
            aria-valuetext={`${confidence.toFixed(1)} persen probabilitas model, bukan kepastian lapangan.`}
          >
            <div className="progress-bar-fill" style={{ width: `${confidence}%` }} />
          </div>
        </div>
      )}
      {showRuleReliability && (
        <p className="harvest-meta">
          <span className="harvest-meta-label">{reliabilityLabel}</span>
          <span>{reliabilityScore}/100 (kelengkapan input/aturan, bukan probabilitas model)</span>
        </p>
      )}

      <p className="harvest-meta">
        <span className="harvest-meta-label">Versi model/aturan</span>
        <span>{prediction.model_version}</span>
      </p>

      {prediction.explanation && (
        <section className="harvest-callout harvest-callout-explain" aria-labelledby={`explain-${prediction.id}`}>
          <div>
            <h4 id={`explain-${prediction.id}`}>Penjelasan</h4>
            <p>{prediction.explanation}</p>
          </div>
        </section>
      )}

      {prediction.recommendation && (
        <section className="harvest-callout harvest-callout-recommend" aria-labelledby={`recommend-${prediction.id}`}>
          <div>
            <h4 id={`recommend-${prediction.id}`}>Rekomendasi</h4>
            <p>{prediction.recommendation}</p>
          </div>
        </section>
      )}

      {prediction.assumptions && (
        <section className="harvest-callout harvest-callout-assume" aria-labelledby={`assume-${prediction.id}`}>
          <div>
            <h4 id={`assume-${prediction.id}`}>Asumsi</h4>
            <p>{prediction.assumptions}</p>
          </div>
        </section>
      )}

      {Object.keys(output).length > 0 && (
        <details className="result-details">
          <summary>Detail teknis output</summary>
          <pre className="result-pre">{JSON.stringify(output, null, 2)}</pre>
        </details>
      )}
    </article>
  );
}
