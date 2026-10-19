// SPDX-License-Identifier: MIT
// The modal where a filter over any property type is chosen and added.

import { useState } from 'react';
import { Button } from '@/components/buttons/Button';
import { DecimalIntegerInput } from '@/components/inputs/DecimalIntegerInput';
import { Input } from '@/components/inputs/Input';
import { Select } from '@/components/inputs/Select';
import { TextInput } from '@/components/inputs/TextInput';
import { Modal } from '@/components/overlays/Modal';
import { type LocaleDates, useLocale } from '@/locale';
import { minstrftime } from '@/util/date';
import { escapeProp, formatDateAndTime } from './table_export';
import type {
  AnonymousSearchPropertySchema,
  SearchPropertySchema,
  SearchSchema,
} from './use_filtered_items';

// The value an option carries when nothing has been chosen. It is a locale key, because the
// select renders it as the prompt above the list.
const notChosen = 'notChosen' as const;

type OptionalValue<T extends string> = T | typeof notChosen;

/**
 * One value an operator may filter a `enum` column by.
 *
 * `label` is rendered as given rather than looked up, because which words name a value is the
 * caller's vocabulary: a filter over a closed set of values labels them however it likes, and
 * this component never has to be told what they mean.
 */
export interface EnumOption {
  readonly value: string;
  readonly label: string;
}

/**
 * Whether a value in the modal's value map is an empty filter rather than a filter.
 *
 * A field the operator has not touched reports `undefined` and is skipped outright; a field they
 * have cleared reports the empty string for every type that stores a string, and `null` for a
 * boolean. What counts as empty is per type, so it is asked of the property rather than of the
 * value.
 */
function isEmptyFilterValue<T>(
  property: AnonymousSearchPropertySchema<T>,
  value: unknown,
): boolean {
  switch (property.type) {
    case 'string': {
      const text = (value ?? '').toString();

      // A trimmed field treats whitespace as nothing; an untrimmed one only treats the exact empty
      // string as nothing, because whitespace there is something the operator typed.
      return property.trim === true ? text.trim() === '' : text === '';
    }
    case 'ip':
    case 'enum':
    case 'dateAndTime':
      return (value ?? '').toString().trim() === '';
    case 'boolean':
      return value === null;
    case 'decimalInteger':
    case 'unsignedHex':
      return false;
  }
}

/**
 * The search text the modal's current field values spell.
 *
 * Every property with a non-empty value contributes one `name=value` term; the rest are left out
 * rather than searched for as empty, so an untouched field narrows nothing.
 */
function getSearchFields<T>(
  searchSchema: SearchSchema<T>,
  valueMap: Record<string, unknown>,
  dates: LocaleDates,
): string[] {
  const fields: string[] = [];

  for (const property of searchSchema.properties) {
    const value = valueMap[property.name];

    if (value === undefined) {
      continue;
    }

    if (isEmptyFilterValue(property, value)) {
      continue;
    }

    const strValue = getFilterValueAsString(property, value, dates);
    fields.push(`${escapeProp(property.name)}=${escapeProp(strValue)}`);
  }

  return fields;
}

/**
 * Searches with a form instead of a search string, one input per searchable property.
 *
 * It produces the same search string the text field would have held, so a caller can offer both and
 * the filter state means one thing. Empty inputs are left out rather than searched for as empty, which
 * is what makes "change one field and keep the rest" work.
 */
export interface GeneralizedSearchModalProps<T> {
  readonly title: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly searchSchema: SearchSchema<T>;
  readonly onSearch: (searchText: string) => void;
  readonly className?: string | undefined;
}

/**
 * A modal with one input per property of a search schema, for filtering on several fields at once.
 *
 * It produces one search string through the same schema the table filters with, so a filter built here
 * and one typed into the search box are the same filter — which is what lets the top panel show the
 * current filters and let this modal edit them without changing what they mean.
 */
export function GeneralizedSearchModal<T>({
  title,
  open,
  onOpenChange,
  searchSchema,
  onSearch,
  className,
}: GeneralizedSearchModalProps<T>): React.JSX.Element {
  const { t, dates } = useLocale();

  const [valueMap, setValueMap] = useState<Record<string, unknown>>({});

  return (
    <Modal title={title} open={open} onOpenChange={onOpenChange} className={className}>
      <div className="grid grid-cols-[auto_auto] gap-2">
        {searchSchema.properties.map((property) => (
          <div key={property.name} className="contents">
            <div>{property.label}: </div>
            <InputComponent
              property={property}
              value={valueMap[property.name]}
              onChange={(value) => {
                setValueMap((map) => ({
                  ...map,
                  [property.name]: value,
                }));
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-center items-center mt-8">
        <Button
          type="encouraging"
          title={t('actions.find')}
          onClick={() => {
            onSearch(getSearchFields(searchSchema, valueMap, dates).join(' '));
            onOpenChange(false);
          }}
        />
      </div>
    </Modal>
  );
}

function BooleanSelect({
  value,
  onChange,
}: {
  readonly value: boolean | null;
  readonly onChange: (value: boolean | null) => void;
}) {
  type OptionalBoolean = OptionalValue<'true' | 'false'>;

  const { t } = useLocale();

  function booleanToString(value: boolean | null): OptionalBoolean {
    if (value === null) {
      return notChosen;
    }

    if (value) {
      return 'true';
    }

    return 'false';
  }

  function stringToBoolean(value: string): boolean | null {
    switch (value) {
      case 'true': {
        return true;
      }

      case 'false': {
        return false;
      }

      default: {
        return null;
      }
    }
  }

  return (
    <Select
      style={{ width: '100%' }}
      value={booleanToString(value)}
      onChange={(e) => onChange(stringToBoolean(e.currentTarget.value))}
    >
      <option value={notChosen}>{t(notChosen)}</option>
      <option value="true">{t('yes')}</option>
      <option value="false">{t('no')}</option>
    </Select>
  );
}

/**
 * The filter control for a closed set of values.
 *
 * A value held in the data but missing from `options` is still offered, labelled with the value
 * itself, so that a caller who adds a value to their data sees it in the filter before they add it
 * here. Without that, a new value would silently be unfilterable.
 */
function EnumSelect({
  value,
  options,
  onChange,
}: {
  readonly value: string | null;
  readonly options: readonly EnumOption[];
  readonly onChange: (value: string | undefined) => void;
}) {
  const { t } = useLocale();

  const known = new Set(options.map((option) => option.value));

  const unlisted = value !== null && value !== '' && !known.has(value) ? [value] : [];

  return (
    <Select
      style={{ width: '100%' }}
      value={value ?? notChosen}
      onChange={(e) => {
        if (e.currentTarget.value === notChosen) {
          onChange(undefined);

          return;
        }

        onChange(e.currentTarget.value);
      }}
    >
      <option value={notChosen}>{t(notChosen)}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
      {unlisted.map((unlistedValue) => (
        <option key={unlistedValue} value={unlistedValue}>
          {unlistedValue}
        </option>
      ))}
    </Select>
  );
}

function getFilterValueAsString<T>(
  property: AnonymousSearchPropertySchema<T>,
  value: unknown,
  dates: LocaleDates,
): string {
  switch (property.type) {
    case 'enum': {
      // A nullish enum value is dropped by the empty filter above, so the fallback cannot be reached.
      // v8 ignore next
      const asString = (value ?? '').toString();

      return property.options.find((option) => option.value === asString)?.label ?? asString;
    }

    case 'dateAndTime':
      // A dateAndTime value is the timestamp the date input reports, and a cleared one is dropped
      // as empty by the filter above, so nothing but a number gets here; whatever else arrives is
      // read the way every other type reads a value it cannot interpret. The unreached arm stays
      // out of the coverage gate.
      // v8 ignore next
      return typeof value === 'number' ? formatDateAndTime(value, dates) : (value ?? '').toString();

    case 'unsignedHex':
      // A hex field's value is the number its input reports. The filter parser reads the term back
      // with `parseInt(text, 16)`, so the field spells the value as uppercase hex digits rather than
      // as the decimal number it is. The unreached arm stays out of the coverage gate.
      // v8 ignore next
      return typeof value === 'number'
        ? value.toString(16).toUpperCase()
        : (value ?? '').toString();

    default:
      // A value the empty filter did not drop is a string or a number, so the nullish fallback
      // cannot be reached. The unreached arm stays out of the coverage gate.
      // v8 ignore next
      return (value ?? '').toString();
  }
}

function DateAndTimeInput({
  value,
  onChange,
}: {
  readonly value: number | null;
  readonly onChange: (value: number | null) => void;
}) {
  return (
    <Input
      type="datetime-local"
      style={{ width: '100%' }}
      value={value === null ? '' : minstrftime('%FT%T', new Date(value))}
      onChange={(e) => {
        if (e.currentTarget.value === '') {
          onChange(null);
        } else {
          onChange(new Date(e.currentTarget.value).getTime());
        }
      }}
      step={1}
    />
  );
}

function filterIpCharacters(s: string) {
  return s.replace(/[^\d.]+/g, '');
}

/**
 * The value the modal holds, narrowed to the type its property's control takes.
 *
 * The map is keyed by a name the modal reads with, so it carries `unknown`; each control is given
 * the value narrowed with `typeof` instead of a cast, and a value of no other kind reports as the
 * control's own absence, which is also what an untouched field holds.
 */
function valueAsString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function valueAsNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function valueAsNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

function valueAsBooleanOrNull(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function InputComponent<T>({
  property,
  value,
  onChange,
}: {
  readonly property: SearchPropertySchema<T>;
  readonly value: unknown;
  readonly onChange: (value: unknown) => void;
}) {
  switch (property.type) {
    case 'string': {
      return (
        <TextInput
          inputPadding="0 0.5rem"
          width="100%"
          clearIconInnerClassName="size-2"
          value={valueAsString(value)}
          onChange={(e) => {
            if (property.trim) {
              onChange(e.currentTarget.value.trim());
            } else {
              onChange(e.currentTarget.value);
            }
          }}
          onClearClick={() => onChange('')}
        />
      );
    }

    case 'ip': {
      return (
        <TextInput
          inputPadding="0 0.5rem"
          width="100%"
          clearIconInnerClassName="size-2"
          value={valueAsString(value)}
          onChange={(e) => onChange(filterIpCharacters(e.currentTarget.value))}
          onClearClick={() => onChange('')}
        />
      );
    }

    case 'decimalInteger': {
      return (
        <DecimalIntegerInput
          value={valueAsNumber(value)}
          minValue={Math.max(Number.MIN_SAFE_INTEGER, property.min ?? Number.MIN_SAFE_INTEGER)}
          maxValue={Math.min(Number.MAX_SAFE_INTEGER, property.max ?? Number.MAX_SAFE_INTEGER)}
          onChange={onChange}
          onClear={() => onChange(undefined)}
        />
      );
    }

    case 'boolean': {
      return <BooleanSelect value={valueAsBooleanOrNull(value)} onChange={onChange} />;
    }

    case 'enum': {
      return (
        <EnumSelect
          value={value === null || value === undefined ? null : String(value)}
          options={property.options}
          onChange={onChange}
        />
      );
    }

    case 'dateAndTime': {
      return <DateAndTimeInput value={valueAsNumberOrNull(value)} onChange={onChange} />;
    }

    case 'unsignedHex': {
      return (
        <DecimalIntegerInput
          value={valueAsNumber(value)}
          minValue={Math.max(0, property.min ?? 0)}
          maxValue={Math.min(Number.MAX_SAFE_INTEGER, property.max ?? Number.MAX_SAFE_INTEGER)}
          base={16}
          onChange={onChange}
          onClear={() => onChange(undefined)}
        />
      );
    }
  }
}
