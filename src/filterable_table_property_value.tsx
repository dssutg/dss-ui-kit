import { formatDateAndTime } from '@/filterable_table_export';
import { getEnumLabel } from '@/filterable_table_internal';
import type { SearchPropertySchema } from '@/filterable_table_search';
import { formatHexNumber } from '@/lib/format_number';
import { useLocale } from '@/locale';

export function useSearchSchemaPropertyValueToString<T>() {
  const { t, lang } = useLocale();

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
        return formatDateAndTime(property.extractValue(item), lang);
    }
  };
}
