import { formatHexNumber } from '@/lib/format_number';
import { useLocale } from '@/locale';
import { formatDateAndTime } from './filterable_table_export';
import { getEnumLabel } from './filterable_table_internal';
import type { SearchPropertySchema } from './filterable_table_search';

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
