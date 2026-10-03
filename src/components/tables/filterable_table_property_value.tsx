import { formatHexNumber } from '@/lib/format_number';
import { useLocale } from '@/locale';
import { getEnumLabel } from './ControlledTable';
import { formatDateAndTime } from './table_export';
import type { SearchPropertySchema } from './use_filtered_items';

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
