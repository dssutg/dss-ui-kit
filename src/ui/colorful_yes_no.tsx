import { useLocale } from '@/locale';

export function ColorfulYesNo({
  yes,
  yesIsBad = false,
}: {
  readonly yes: boolean;
  readonly yesIsBad?: boolean;
}) {
  const { t } = useLocale();

  if (yesIsBad) {
    if (yes) {
      return <span className="text-tno">{t('yes')}</span>;
    }
    return <span className="text-tok">{t('no')}</span>;
  }

  if (yes) {
    return <span className="text-tok">{t('yes')}</span>;
  }
  return <span className="text-tno">{t('no')}</span>;
}
