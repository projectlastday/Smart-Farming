import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  displayAutocompleteValue,
  rankAutocompleteOptions,
  resolveTypedValue,
  type AutocompleteOption,
} from '@/lib/autocomplete';

type AutocompleteProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: AutocompleteOption[];
  placeholder?: string;
  emptyOption?: AutocompleteOption;
  allowCustom?: boolean;
  noMatchLabel?: string;
  required?: boolean;
  maxResults?: number;
};

export function Autocomplete({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
  emptyOption,
  allowCustom = false,
  noMatchLabel = 'Tidak ada data yang cocok',
  required = false,
  maxResults,
}: AutocompleteProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(() => displayAutocompleteValue(value, options));
  const [highlight, setHighlight] = useState(0);

  const committedDisplay = displayAutocompleteValue(value, options);
  const rankingQuery = inputValue === committedDisplay ? '' : inputValue;
  const suggestions = useMemo(
    () => rankAutocompleteOptions(options, rankingQuery, emptyOption, maxResults),
    [options, rankingQuery, emptyOption, maxResults],
  );

  useEffect(() => {
    if (!open) {
      setInputValue(displayAutocompleteValue(value, options));
    }
  }, [value, options, open]);

  useEffect(() => {
    setHighlight(0);
  }, [inputValue, open]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (target && rootRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [open]);

  const commit = (nextValue: string, nextInput?: string) => {
    onChange(nextValue);
    setInputValue(nextInput ?? displayAutocompleteValue(nextValue, options));
    setOpen(false);
  };

  const selectOption = (option: AutocompleteOption) => {
    commit(option.value, option.value ? option.label : '');
  };

  const handleInputChange = (next: string) => {
    setInputValue(next);
    setOpen(true);
    onChange(resolveTypedValue(next, options, allowCustom, emptyOption));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setHighlight((index) => (suggestions.length === 0 ? 0 : (index + 1) % suggestions.length));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setHighlight((index) =>
        suggestions.length === 0 ? 0 : (index - 1 + suggestions.length) % suggestions.length,
      );
    } else if (event.key === 'Enter') {
      if (open && suggestions[highlight]) {
        event.preventDefault();
        selectOption(suggestions[highlight]);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setInputValue(displayAutocompleteValue(value, options));
    }
  };

  const activeId = open && suggestions[highlight] ? `${id}-option-${highlight}` : undefined;
  const showNoMatch = open && suggestions.length === 0;
  const canClear = allowCustom ? Boolean(inputValue) : Boolean(value);

  return (
    <div className="form-group autocomplete" ref={rootRef}>
      <label htmlFor={id}>{label}</label>
      <div className="autocomplete-control">
        <input
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          aria-haspopup="listbox"
          aria-required={required || undefined}
          placeholder={placeholder ?? emptyOption?.label}
          value={inputValue}
          onChange={(event) => handleInputChange(event.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {canClear && (
          <button
            type="button"
            className="autocomplete-clear"
            aria-label={`Hapus ${label}`}
            onClick={() => commit('')}
          >
            ×
          </button>
        )}
        {open && (
          <ul className="autocomplete-list" id={listboxId} role="listbox" aria-label={`Saran ${label}`}>
            {showNoMatch ? (
              <li className="autocomplete-empty" role="presentation">
                {noMatchLabel}
              </li>
            ) : (
              suggestions.map((option, index) => (
                <li
                  key={`${option.value}-${option.label}`}
                  id={`${id}-option-${index}`}
                  role="option"
                  aria-selected={index === highlight}
                  className={index === highlight ? 'autocomplete-option is-active' : 'autocomplete-option'}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => selectOption(option)}
                >
                  <span>{option.label}</span>
                  {option.description ? (
                    <span className="autocomplete-option-desc">{option.description}</span>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
