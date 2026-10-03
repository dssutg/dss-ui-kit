import { formatHexNumber } from '@/lib/format_number';
import { useLocale } from '@/locale';
import { getEnumLabel } from './ControlledTable';
import { formatDateAndTime } from './table_export';
import type { SearchPropertySchema } from './use_filtered_items';

/**
 * Returns a function that writes one property's value of one item as text, in the caller's locale.
 *
 * One place that knows how every property type is written, used by the filter builder, the timeline
 * labels and the export: a value rendered differently in each of them would make a table, its export
 * and its filter disagree about what a row says.
 */
export function useSearchSchemaPropertyValueToString<T>() {
  const { t, dates } = useLocale();

  return (item: T, property: SearchPropertySchema<T>) => {
    switch (property.type) {
      case 'boolean':
        if (property.extractValue(item)) {
          return t('yes');
        }
        return t('no');
      case 'enum':
        return getEnumLabel(property, property.extractValue(item));
      case 'string':
      case 'decimalInteger':
      case 'ip':
        return property.extractValue(item).toString();
      case 'unsignedHex':
        return formatHexNumber(property.extractValue(item), 1);
      case 'dateAndTime':
        return formatDateAndTime(property.extractValue(item), dates);
    }
  };
}
