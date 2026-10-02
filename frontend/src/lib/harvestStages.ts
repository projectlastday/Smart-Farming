/** Stages assigned in backend/app/predictors/rules.py `predict_harvest`. */
export const HARVEST_STAGE_LABELS = {
  not_yet_planted: 'Belum Ditanam',
  vegetative: 'Vegetatif',
  reproductive: 'Reproduktif',
  ripening: 'Pematangan',
  near_harvest: 'Mendekati Panen',
  overdue: 'Jendela Panen Terlewat',
  harvested: 'Sudah Dipanen',
} as const;

export type HarvestStageCode = keyof typeof HARVEST_STAGE_LABELS;

const KNOWN_CODES = Object.keys(HARVEST_STAGE_LABELS) as HarvestStageCode[];

export function normalizeHarvestStageCode(code: string): string {
  return code.trim().toLowerCase().replace(/-/g, '_');
}

export function harvestStageLabel(code: string): string {
  const key = normalizeHarvestStageCode(code);
  if (key in HARVEST_STAGE_LABELS) {
    return HARVEST_STAGE_LABELS[key as HarvestStageCode];
  }
  return 'Tahap tidak diketahui';
}

/** Replace known stage tokens (and leftover snake_case codes) in user-facing copy. */
export function localizeHarvestStageCopy(text: string): string {
  let result = text;
  for (const code of KNOWN_CODES) {
    const token = code.replace(/_/g, '[-_]?');
    result = result.replace(new RegExp(`\\b${token}\\b`, 'gi'), HARVEST_STAGE_LABELS[code]);
  }
  result = result.replace(/\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/gi, (match) => harvestStageLabel(match));
  return result;
}
