import { highlightText } from '@/util/highlight';

/**
 * Renders a JSON string with its keys, strings, numbers and literals coloured.
 *
 * The value is a string, not an object, and is highlighted as text: the caller has already parsed it,
 * or has the response body as it arrived. Nothing here re-formats it, so what is shown is byte for
 * byte what was passed in.
 */
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
