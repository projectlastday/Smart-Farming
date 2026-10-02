import type { Prediction } from '@/types';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

export function isNotApplicableOutput(output: Record<string, unknown> | undefined): boolean {
  const data = output ?? {};
  return (
    data.not_applicable === true ||
    data.status === 'not_applicable' ||
    String(data.label ?? '').includes('Tidak Berlaku')
  );
}

export function compactReliabilityCaption(prediction: Prediction): string | null {
  if (isNotApplicableOutput(prediction.output)) return null;
  const reliability = asRecord(prediction.output?.reliability);
  const kind = asString(reliability.kind);
  if (kind === 'model_probability') {
    const score =
      typeof reliability.score === 'number' && Number.isFinite(reliability.score)
        ? Number(reliability.score)
        : prediction.confidence != null && Number.isFinite(Number(prediction.confidence))
          ? Number(prediction.confidence)
          : null;
    if (score == null) return null;
    return `Probabilitas model ${score.toFixed(1)}%`;
  }
  if (kind === 'rule_completeness') {
    const label = asString(reliability.label) ?? 'Keandalan aturan';
    const score =
      typeof reliability.score === 'number' && Number.isFinite(reliability.score)
        ? Number(reliability.score)
        : null;
    return score == null ? label : `${label} ${score}/100`;
  }
  return null;
}

export function historyReliabilityLabel(prediction: Prediction): {
  badge: 'not_applicable' | null;
  text: string;
} {
  if (isNotApplicableOutput(prediction.output)) {
    return { badge: 'not_applicable', text: 'Tidak Berlaku' };
  }
  const caption = compactReliabilityCaption(prediction);
  if (caption) return { badge: null, text: caption };
  return { badge: null, text: 'Keandalan aturan' };
}
