import { useLocale } from '@/locale';
import { cn } from '@/util/cn';

/**
 * Reads yes or no in a colour, for a panel where the answer is a status.
 *
 * `yesIsBad` exists because yes is the good answer in most of these panels and the bad answer in
 * enough of them that the default would be wrong either way. Both words come from the locale.
 *
 * The word is always the answer and the colour is always `yesIsBad`'s opinion of it, so this used to be
 * four returns differing only in those two things. It is now one: `yesIsBad` decides the colour, and
 * nothing about which word to print depends on it.
 */
export function ColorfulYesNo({
  yes,
  yesIsBad = false,
  className,
}: {
  readonly yes: boolean;
  readonly yesIsBad?: boolean | undefined;
  readonly className?: string | undefined;
}): React.JSX.Element {
  const { t } = useLocale();

  return (
    <span className={cn(yes === yesIsBad ? 'text-tno' : 'text-tok', className)}>
      {yes ? t('yes') : t('no')}
    </span>
  );
}
