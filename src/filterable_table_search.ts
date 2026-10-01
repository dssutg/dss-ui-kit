import type { EnumOption } from '@/FilterableTableTopPanel';
import { escapeProp, formatDateAndTime } from '@/filterable_table_export';
import { getEnumLabel } from '@/filterable_table_internal';
import { clamp } from '@/lib/math';
import { useLocale } from '@/locale';

export type AnonymousSearchPropertySchema<T> =
  | {
      type: 'string';
      default?: string | undefined;
      extractValue: (item: T) => string;
      trim?: boolean | undefined;
    }
  | {
      type: 'decimalInteger';
      default?: number | undefined;
      extractValue: (item: T) => number;
      min?: number | undefined;
      max?: number | undefined;
    }
  | {
      type: 'boolean';
      default?: boolean | null | undefined;
      extractValue: (item: T) => boolean;
    }
  | {
      type: 'enum';
      default?: string | null | undefined;
      extractValue: (item: T) => string;
      /**
       * The values the operator may filter by, and how to label each one. A column is a closed set
       * of values in every table this serves, but which set is the caller's: naming them here is
       * what lets one filter control serve device types, connection states or anything else without
       * this module knowing any of them.
       *
       * A value present in the data but absent from `options` still renders, labelled with the
       * value itself, so a new value in the caller's data is visible before it is added here.
       */
      options: readonly EnumOption[];
    }
  | {
      type: 'ip';
      default?: string | null | undefined;
      extractValue: (item: T) => string;
    }
  | {
      type: 'unsignedHex';
      default?: number | null | undefined;
      extractValue: (item: T) => number;
      min?: number | undefined;
      max?: number | undefined;
    }
  | {
      type: 'dateAndTime';
      default?: number | null | undefined;
      extractValue: (item: T) => number;
    };

export type SearchPropertySchema<T> = AnonymousSearchPropertySchema<T> & {
  name: string;
  label: string;
  hiddenInTable?: boolean | undefined;
};

export type SearchPropertySchemaType<T> =
  SearchPropertySchema<T> extends {
    type: infer U;
  }
    ? U
    : never;

export type SearchPropertySchemaName<T> =
  SearchPropertySchema<T> extends {
    name: infer U;
  }
    ? U
    : never;

export type SearchPropertySchemaExtractedValue<T> = ReturnType<
  SearchPropertySchema<T> extends { extractValue: infer U } ? U : never
>;

export interface SearchSchema<T> {
  properties: SearchPropertySchema<T>[];
}

export function buildFilterableTableSearchText(keyValueMap: Record<string, unknown>) {
  return Object.entries(keyValueMap)
    .map(([prop, value]) => `${escapeProp(prop)}=${escapeProp((value ?? '').toString())}`)
    .join(' ');
}

export function useFilteredItems<T>({
  items,
  searchText,
  searchSchema,
}: {
  readonly items: T[];
  readonly searchText: string;
  readonly searchSchema: SearchSchema<T>;
}) {
  const { lang } = useLocale();

  if (searchText === '') {
    return items;
  }

  function cleanupWhitespace(s: string) {
    return s.trim().replace(/\s+/g, ' ');
  }

  function normalize(s: string) {
    return cleanupWhitespace(s.toLowerCase());
  }

  function parsePart(part: string) {
    for (const property of searchSchema.properties) {
      const prefix = `${property.name}=`;
      const valueString = part.slice(prefix.length);

      if (!part.startsWith(prefix) || valueString === '') {
        continue;
      }

      switch (property.type) {
        case 'string': {
          if (property.trim) {
            return { property, value: valueString.trim() };
          }
          return { property, value: valueString };
        }

        case 'enum':
        case 'dateAndTime': {
          return { property, value: valueString };
        }

        case 'ip': {
          return {
            property,
            value: valueString.replace(/[^\d.]+/g, ''),
          };
        }

        case 'boolean': {
          if (valueString === 'true' || valueString === 'false') {
            return { property, value: valueString === 'true' };
          }
          return null;
        }

        case 'decimalInteger': {
          return {
            property,
            value: clamp(
              Math.floor(Number(valueString) || 0),
              Math.max(Number.MIN_SAFE_INTEGER, property.min ?? Number.MIN_SAFE_INTEGER),
              Math.min(Number.MAX_SAFE_INTEGER, property.max ?? Number.MAX_SAFE_INTEGER),
            ),
          };
        }

        case 'unsignedHex': {
          return {
            property,
            value: clamp(
              Math.floor(parseInt(valueString, 16) || 0),
              Math.max(0, property.min ?? 0),
              Math.min(Number.MAX_SAFE_INTEGER, property.max ?? Number.MAX_SAFE_INTEGER),
            ),
          };
        }
      }
    }

    return null;
  }

  const fuzzyParts: string[] = [];
  const props: {
    property: SearchPropertySchema<T>;
    value: unknown;
  }[] = [];

  // Match sequences of:
  //  - backslash + any char (escaped char),
  //  - or any non-whitespace char
  // repeated to form tokens
  const parts = (cleanupWhitespace(searchText).match(/(?:\\.|[^\s])+/g) ?? []).map((part) =>
    part.replace(/\\(.)/g, '$1'),
  );

  for (const part of parts) {
    const pair = parsePart(part);

    if (pair === null) {
      fuzzyParts.push(part);
    } else {
      props.push(pair);
    }
  }

  const fuzzy = normalize(fuzzyParts.join(' '));

  return items.filter((item) => {
    for (const { property, value } of props) {
      switch (property.type) {
        case 'string':
        case 'ip': {
          const itemValue = normalize(property.extractValue(item));
          const stringValue = normalize((value ?? '').toString());

          if (!itemValue.includes(stringValue)) {
            return false;
          }

          break;
        }

        case 'enum': {
          const itemValue = normalize(getEnumLabel(property, property.extractValue(item)));
          const stringValue = normalize((value ?? '').toString());

          if (!itemValue.includes(stringValue)) {
            return false;
          }

          break;
        }

        case 'dateAndTime': {
          const itemValue = formatDateAndTime(property.extractValue(item), lang);

          const stringValue = normalize((value ?? '').toString());

          if (!itemValue.includes(stringValue)) {
            return false;
          }

          break;
        }

        default: {
          if (property.extractValue(item) !== value) {
            return false;
          }

          break;
        }
      }
    }

    return normalize(
      searchSchema.properties
        .map((property) => {
          switch (property.type) {
            case 'enum':
              return getEnumLabel(property, property.extractValue(item));
            case 'dateAndTime':
              return formatDateAndTime(property.extractValue(item), lang);
            default:
              return property.extractValue(item);
          }
        })
        .join(' '),
    ).includes(fuzzy);
  });
}
