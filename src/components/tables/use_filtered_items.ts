import { useLocale } from '@/locale';
import { clamp } from '@/util/math';
import { getEnumLabel } from './ControlledTable';
import type { EnumOption } from './FilterableTableTopPanel';
import { escapeProp, formatDateAndTime } from './table_export';

/**
 * How one property of an item is searched and filtered, without a name or a label.
 *
 * A union over the property's type, not a record of optional fields, so `type` decides which of the
 * rest exist: a `string` property has no `min`, and a schema that could hold both would have to be
 * narrowed at every use. `extractValue` is the only part that touches the caller's data — it is what
 * makes a filter over an arbitrary record type possible at all.
 */
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
       * what lets one filter control serve a closed set of values of any kind without this module
       * knowing what they are.
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

/**
 * One property of a {@link SearchSchema}, named and labelled.
 *
 * `hiddenInTable` is what makes a filterable property one that is not also a column; see
 * {@link FilterableTableFilterProperty}.
 */
export type SearchPropertySchema<T> = AnonymousSearchPropertySchema<T> & {
  name: string;
  label: string;
  hiddenInTable?: boolean | undefined;
};

/**
 * The property types a {@link SearchPropertySchema} can declare, derived from it rather than listed
 * beside it, so adding a member to the schema widens this type too — there is no second list to keep
 * in step.
 */
export type SearchPropertySchemaType<T> =
  SearchPropertySchema<T> extends {
    type: infer U;
  }
    ? U
    : never;

/**
 * The names a {@link SearchPropertySchema}'s properties go by, derived from it.
 *
 * This is how the schema's caller names a property — the stats and timeline modals keep the property
 * they are reporting on in state as this type — and because it is the caller's own names rather than
 * a generic `string`, a property the schema does not declare cannot be asked for.
 */
export type SearchPropertySchemaName<T> =
  SearchPropertySchema<T> extends {
    name: infer U;
  }
    ? U
    : never;

/**
 * Everything a {@link SearchPropertySchema}'s `extractValue` functions can return, as one union.
 *
 * An extracted value's type belongs to the property, so what a schema-wide consumer reads is the
 * union of all of them; deriving it saves that consumer writing the union itself — and changing it
 * when the schema gains a property type that returns something new.
 */
export type SearchPropertySchemaExtractedValue<T> = ReturnType<
  SearchPropertySchema<T> extends { extractValue: infer U } ? U : never
>;

/**
 * The properties of one table that can be searched, filtered and exported.
 *
 * The same schema drives the search box, the filter modal, the statistics and the export, which is why
 * it is passed around instead of each of those deriving its own: a filter that searched a different
 * field from the one the table showed would be a bug in the caller's wiring rather than a visible
 * error.
 */
export interface SearchSchema<T> {
  properties: SearchPropertySchema<T>[];
}

/**
 * Writes a record as the search text a table's filters read: one `name=value` term per entry, each
 * half escaped with {@link escapeProp}, joined with spaces.
 *
 * One writer, because {@link useFilteredItems} parses this same grammar, and the two must not learn
 * to disagree.
 */
export function buildFilterableTableSearchText(keyValueMap: Record<string, unknown>) {
  return Object.entries(keyValueMap)
    .map(([prop, value]) => `${escapeProp(prop)}=${escapeProp((value ?? '').toString())}`)
    .join(' ');
}

/** A search term matched to the property it constrains, and the value that property compares against. */
interface ParsedSearchProperty<T> {
  property: SearchPropertySchema<T>;
  value: unknown;
}

/**
 * Converts the text written after `name=` into the value its property compares against.
 *
 * The property decides what its own text means, so the conversion travels with the property rather
 * than with the schema. `null` means the text is not a value this property can hold — a `boolean`
 * written as anything but `true` or `false` — which the caller reads exactly as it reads a term that
 * names no property: the text stays a free-text search term instead of filtering on nothing.
 */
function parsePropertyValue<T>(
  property: SearchPropertySchema<T>,
  valueString: string,
): ParsedSearchProperty<T> | null {
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

/**
 * The items of a table that match a search string, filtered in place with no copy when the search is
 * empty.
 *
 * The search string is the one this library's own filter builder writes — properties named and valued,
 * separated by spaces — so what the table filters by and what the filter modal shows are the same
 * thing. A term for a property narrows the result set; a term for a property the schema does not
 * declare is ignored rather than treated as unmatched, because an unknown field is a stale search and
 * not a filter that found nothing.
 */
export function useFilteredItems<T>({
  items,
  searchText,
  searchSchema,
}: {
  readonly items: T[];
  readonly searchText: string;
  readonly searchSchema: SearchSchema<T>;
}) {
  const { dates } = useLocale();

  if (searchText === '') {
    return items;
  }

  function cleanupWhitespace(s: string) {
    return s.trim().replace(/\s+/g, ' ');
  }

  function normalize(s: string) {
    return cleanupWhitespace(s.toLowerCase());
  }

  /**
   * Whether one item satisfies one parsed term.
   *
   * Text-valued properties are compared on their normalized text, so a term matches wherever it
   * appears in the value rather than only as the whole of it. The remaining properties are compared
   * against the value as written, which is why a `boolean` term written as anything but `true` or
   * `false` never reaches here.
   */
  function matchesProperty(item: T, { property, value }: ParsedSearchProperty<T>) {
    switch (property.type) {
      case 'string':
      case 'ip': {
        const itemValue = normalize(property.extractValue(item));
        const stringValue = normalize((value ?? '').toString());

        return itemValue.includes(stringValue);
      }

      case 'enum': {
        const itemValue = normalize(getEnumLabel(property, property.extractValue(item)));
        const stringValue = normalize((value ?? '').toString());

        return itemValue.includes(stringValue);
      }

      case 'dateAndTime': {
        const itemValue = formatDateAndTime(property.extractValue(item), dates);

        const stringValue = normalize((value ?? '').toString());

        return itemValue.includes(stringValue);
      }

      default: {
        return property.extractValue(item) === value;
      }
    }
  }

  /**
   * The text a free-text term is matched against: every property of the item, normalized once here
   * rather than in each caller.
   */
  function getItemSearchText(item: T) {
    return normalize(
      searchSchema.properties
        .map((property) => {
          switch (property.type) {
            case 'enum':
              return getEnumLabel(property, property.extractValue(item));
            case 'dateAndTime':
              return formatDateAndTime(property.extractValue(item), dates);
            default:
              return property.extractValue(item);
          }
        })
        .join(' '),
    );
  }

  function parsePart(part: string): ParsedSearchProperty<T> | null {
    for (const property of searchSchema.properties) {
      const prefix = `${property.name}=`;
      const valueString = part.slice(prefix.length);

      if (!part.startsWith(prefix) || valueString === '') {
        continue;
      }

      // The first property the term names owns it, so its conversion — or its refusal to convert —
      // decides the term. The loop only runs on when no property claimed it.
      return parsePropertyValue(property, valueString);
    }

    return null;
  }

  const fuzzyParts: string[] = [];
  const props: ParsedSearchProperty<T>[] = [];

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
    for (const property of props) {
      if (!matchesProperty(item, property)) {
        return false;
      }
    }

    return getItemSearchText(item).includes(fuzzy);
  });
}
