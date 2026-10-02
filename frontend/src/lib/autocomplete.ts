import { normalizeSearch } from '@/lib/listControls';

export type AutocompleteOption = {
  value: string;
  label: string;
  description?: string;
};

export const AUTOCOMPLETE_MAX_RESULTS = 12;

function optionSearchText(option: AutocompleteOption): string {
  return normalizeSearch([option.label, option.value, option.description ?? ''].join(' '));
}

export function rankAutocompleteOptions(
  options: AutocompleteOption[],
  query: string,
  emptyOption?: AutocompleteOption,
  maxResults = AUTOCOMPLETE_MAX_RESULTS,
): AutocompleteOption[] {
  const q = normalizeSearch(query);
  const ranked = options
    .map((option) => {
      const label = normalizeSearch(option.label);
      const value = normalizeSearch(option.value);
      const description = normalizeSearch(option.description ?? '');
      let score = -1;
      if (!q) score = 50;
      else if (label === q || value === q) score = 0;
      else if (label.startsWith(q) || value.startsWith(q)) score = 1;
      else if (label.includes(q)) score = 2;
      else if (value.includes(q) || description.includes(q)) score = 3;
      return { option, score };
    })
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return a.option.label.localeCompare(b.option.label, 'id');
    })
    .map((entry) => entry.option);

  const withEmpty =
    emptyOption && (!q || optionSearchText(emptyOption).includes(q))
      ? [emptyOption, ...ranked.filter((option) => option.value !== emptyOption.value)]
      : ranked;

  return withEmpty.slice(0, maxResults);
}

export function displayAutocompleteValue(
  value: string,
  options: AutocompleteOption[],
): string {
  if (!value) return '';
  const match = options.find((option) => option.value === value);
  return match?.label ?? value;
}

export function resolveTypedValue(
  query: string,
  options: AutocompleteOption[],
  allowCustom: boolean,
  emptyOption?: AutocompleteOption,
): string {
  const trimmed = query.trim();
  if (!trimmed) return '';
  if (emptyOption && normalizeSearch(emptyOption.label) === normalizeSearch(trimmed)) {
    return emptyOption.value;
  }
  const lower = normalizeSearch(trimmed);
  const exactValue = options.find((option) => normalizeSearch(option.value) === lower);
  if (exactValue) return exactValue.value;
  const exactLabel = options.find((option) => normalizeSearch(option.label) === lower);
  if (exactLabel) return exactLabel.value;
  return allowCustom ? query : '';
}

export function optionMatchesFilter(selected: string, itemValue: string, itemLabel = ''): boolean {
  if (!selected) return true;
  if (itemValue === selected) return true;
  const q = normalizeSearch(selected);
  return itemValue.toLowerCase().includes(q) || normalizeSearch(itemLabel).includes(q);
}

export function uniqueOptions(options: AutocompleteOption[]): AutocompleteOption[] {
  const seen = new Set<string>();
  return options.filter((option) => {
    const key = `${option.value}::${option.label}`;
    if (seen.has(key) || !option.label.trim()) return false;
    seen.add(key);
    return true;
  });
}
