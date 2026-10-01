import { highlightText } from '@/lib/highlight';

export function HighlightedJson({
  json,
  className,
}: {
  readonly json: string;
  readonly className?: string | undefined;
}) {
  return (
    // biome-ignore lint/style/useNamingConvention: `__html` is the property name React defines on `dangerouslySetInnerHTML`.
    <pre className={className} dangerouslySetInnerHTML={{ __html: highlightText(json, 'json') }} />
  );
}
