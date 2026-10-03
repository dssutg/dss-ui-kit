import { useLocale } from '@/locale';

/**
 * Reads yes or no in a colour, for a panel where the answer is a status.
 *
 * `yesIsBad` exists because yes is the good answer in most of these panels and the bad answer in
 * enough of them that the default would be wrong either way. Both words come from the locale.
 */
export function ColorfulYesNo({
  yes,
  yesIsBad = false,
}: {
  readonly yes: boolean;
  readonly yesIsBad?: boolean | undefined;
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
