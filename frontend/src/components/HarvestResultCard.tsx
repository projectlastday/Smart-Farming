import { useId } from 'react';
import { harvestStageLabel, localizeHarvestStageCopy } from '@/lib/harvestStages';
import type { Prediction } from '@/types';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function formatIsoDate(value: string): string | null {
  const isoDate = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!isoDate) return null;
  const [year, month, day] = isoDate[1].split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function CalloutIcon({ name }: { name: 'info' | 'action' | 'note' }) {
  const title =
    name === 'info' ? 'Penjelasan' : name === 'action' ? 'Rekomendasi' : 'Asumsi';
  return (
    <svg className="harvest-callout-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <title>{title}</title>
      {name === 'info' && (
        <path
          fill="currentColor"
          d="M10 2a8 8 0 1 0 .001 16.001A8 8 0 0 0 10 2Zm.75 12.25h-1.5v-5.5h1.5v5.5ZM10 7.25a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"
        />
      )}
      {name === 'action' && (
        <path
          fill="currentColor"
          d="M10 2 3.5 5v5.5c0 4 2.8 7.7 6.5 8.5 3.7-.8 6.5-4.5 6.5-8.5V5L10 2Zm-.2 11.2-2.8-2.8 1.1-1.1 1.7 1.7 3.4-3.4 1.1 1.1-4.5 4.5Z"
        />
      )}
      {name === 'note' && (
        <path
          fill="currentColor"
          d="M5 3.5A1.5 1.5 0 0 0 3.5 5v10A1.5 1.5 0 0 0 5 16.5h7.2L16.5 12V5A1.5 1.5 0 0 0 15 3.5H5Zm7 12V12h3.5L12 15.5Z"
        />
      )}
    </svg>
  );
}

export function HarvestResultCard({
  prediction,
  compact = false,
}: {
  prediction: Prediction;
  compact?: boolean;
}) {
  const uid = useId();
  const output = asRecord(prediction.output);
  const notApplicable =
    output.not_applicable === true ||
    output.status === 'not_applicable' ||
    String(output.label ?? '').includes('Tidak Berlaku');

  const startRaw = asString(output.estimated_harvest_start);
  const endRaw = asString(output.estimated_harvest_end);
  const startLabel = startRaw ? formatIsoDate(startRaw) : null;
  const endLabel = endRaw ? formatIsoDate(endRaw) : null;
  const hasWindow = Boolean(startLabel || endLabel);

  const stageKey = asString(output.growth_stage);
  const stageLabel = stageKey ? harvestStageLabel(stageKey) : null;
  const explanation = prediction.explanation
    ? localizeHarvestStageCopy(prediction.explanation)
    : null;
  const recommendation = prediction.recommendation
    ? localizeHarvestStageCopy(prediction.recommendation)
    : null;
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

  const limitations = Array.isArray(output.limitations)
    ? output.limitations.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
  const helperNote =
    limitations[0] ??
    (prediction.recommendation
      ? 'Gunakan hasil ini sebagai perkiraan. Periksa kondisi lapangan sebelum menentukan jadwal panen.'
      : null);

  const titleId = `${uid}-harvest-result-title`;
  const confidenceLabelId = `${uid}-harvest-confidence-label`;
  const explainId = `${uid}-harvest-explain-title`;
  const recommendId = `${uid}-harvest-recommend-title`;
  const assumeId = `${uid}-harvest-assume-title`;

  const body = (
    <>
      {!compact && (
      <header className="harvest-result-header">
        <h3 id={titleId}>Prediksi Panen</h3>
        <div className="harvest-result-badges">
          {notApplicable && <span className="badge">Tidak Berlaku</span>}
          {stageLabel && !notApplicable && (
            <span className="badge harvest-stage-badge" aria-label={`Tahap pertumbuhan: ${stageLabel}`}>
              {stageLabel}
            </span>
          )}
        </div>
      </header>
      )}
      {compact && (notApplicable || stageLabel) && (
        <div className="harvest-result-badges">
          {notApplicable && <span className="badge">Tidak Berlaku</span>}
          {stageLabel && !notApplicable && (
            <span className="badge harvest-stage-badge" aria-label={`Tahap pertumbuhan: ${stageLabel}`}>
              {stageLabel}
            </span>
          )}
        </div>
      )}

      {hasWindow && !notApplicable && (
        <p className="harvest-hero">
          <span className="harvest-hero-label">Perkiraan jendela panen</span>
          <span className="harvest-hero-dates">
            {startLabel && endLabel && startLabel !== endLabel
              ? `${startLabel} – ${endLabel}`
              : startLabel ?? endLabel}
          </span>
        </p>
      )}

      {showModelMeter && confidence != null && (
        <div className="harvest-confidence">
          <div className="harvest-confidence-copy">
            <span id={confidenceLabelId}>Probabilitas model</span>
            <strong aria-hidden="true">{confidence.toFixed(1)}%</strong>
          </div>
          <div
            className="progress-bar harvest-confidence-bar"
            role="meter"
            aria-labelledby={confidenceLabelId}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Number(confidence.toFixed(1))}
            aria-valuetext={`${confidence.toFixed(1)} persen probabilitas model, bukan kepastian lapangan.`}
          >
            <div className="progress-bar-fill" style={{ width: `${confidence}%` }} />
          </div>
          <p className="harvest-confidence-note">Angka ini berasal dari keluaran model, bukan kepastian lapangan.</p>
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

      {explanation && (
        <section className="harvest-callout harvest-callout-explain" aria-labelledby={explainId}>
          <CalloutIcon name="info" />
          <div>
            <h4 id={explainId}>Penjelasan</h4>
            <p>{explanation}</p>
          </div>
        </section>
      )}

      {recommendation && (
        <section className="harvest-callout harvest-callout-recommend" aria-labelledby={recommendId}>
          <CalloutIcon name="action" />
          <div>
            <h4 id={recommendId}>Rekomendasi</h4>
            <p>{recommendation}</p>
          </div>
        </section>
      )}

      {prediction.assumptions && (
        <section className="harvest-callout harvest-callout-assume" aria-labelledby={assumeId}>
          <CalloutIcon name="note" />
          <div>
            <h4 id={assumeId}>Asumsi</h4>
            <p>{prediction.assumptions}</p>
          </div>
        </section>
      )}

      {helperNote && (
        <p className="harvest-helper" role="note">
          {helperNote}
        </p>
      )}
    </>
  );

  if (compact) {
    return <div className="harvest-result harvest-result-compact">{body}</div>;
  }

  return (
    <article className="card result-block harvest-result" aria-labelledby={titleId}>
      {body}
    </article>
  );
}
