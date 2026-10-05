import { useMemo, useState } from 'react';
import { useLocale } from '@/locale';
import { cn } from '@/util/cn';
import { cmp } from '@/util/math';

/**
 * Shows a number as its individual bits, with a description for each bit that is set.
 *
 * `flagDescriptionMap` maps a bit position to the word an operator reads, so the component renders a
 * value and the caller supplies the vocabulary — the same descriptions on a panel and in a tooltip are
 * two calls of one map. `octetCount` is how many bytes are shown, which for a value wider than that
 * means the high bits are not displayed at all rather than being folded in.
 */
export function BitField({
  flags,
  flagDescriptionMap,
  showEntireDescription = false,
  octetCount = 4,
  className,
}: {
  readonly flags: number;
  readonly flagDescriptionMap: Readonly<Record<number, string>>;
  readonly showEntireDescription?: boolean | undefined;
  readonly octetCount?: number | undefined;
  readonly className?: string | undefined;
}): React.JSX.Element {
  // IMPORTANT: Bitwise operators are not used to support numbers greater than 32-bit

  const { t } = useLocale();

  const octetShifts = useMemo(() => {
    return Array.from({ length: octetCount }, (_, index) => (octetCount - 1 - index) * 8);
  }, [octetCount]);

  const totalBits = octetCount * 8;

  const [highlightedBitIndex, setHighlightedBitIndex] = useState(-1);

  const bitWidth = 10;
  const nibbleGap = 6;
  const octetGap = 16;
  const fontSize = 16;
  const lineHeight = 24;
  const xDeltaBias = 12;
  const yDeltaBias = -14;
  const offsetMarkerFontSize = 10;
  const offsetMarkerLineHeight = 10;

  const octetGapCount = octetCount - 1;
  const nibbleGapCount = octetCount;
  const octetBitFieldPanelWidth =
    totalBits * bitWidth +
    octetGapCount * octetGap +
    nibbleGapCount * nibbleGap +
    xDeltaBias +
    fontSize;

  const finalDescriptionMap = useMemo(() => {
    return Object.entries(flagDescriptionMap)
      .toSorted(([a], [b]) => cmp(Number(a), Number(b)))
      .filter(
        ([bitIndex]) =>
          Number(bitIndex) < totalBits &&
          (showEntireDescription || Math.floor(flags / 2 ** Number(bitIndex)) % 2 !== 0),
      );
  }, [totalBits, flags, showEntireDescription, flagDescriptionMap]);

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="flex" style={{ gap: octetGap }}>
        {octetShifts.map((offset, index) => {
          const octet = Math.floor(flags / 2 ** offset) % 256;

          const octetIndex = octetCount - 1 - index;

          return (
            <div
              key={index}
              className="flex flex-col justify-center text-nowrap"
              style={{
                fontSize: `${fontSize}px`,
                lineHeight: `${lineHeight}px`,
              }}
            >
              <div className="text-center">{octet.toString(16).toUpperCase().padStart(2, '0')}</div>
              <div className="flex justify-between gap-1">
                {[octetIndex * 8 + 8 - 1, octetIndex * 8].map((offset, index) => (
                  <div
                    key={index}
                    className="text-tpd"
                    style={{
                      fontSize: `${offsetMarkerFontSize}px`,
                      lineHeight: `${offsetMarkerLineHeight}px`,
                    }}
                  >
                    {offset}
                  </div>
                ))}
              </div>
              <div className="flex text-lg" style={{ gap: nibbleGap }}>
                {Array.from({ length: 2 }, (_, nibbleIndex) => (
                  <div key={nibbleIndex} className="flex">
                    {Array.from(
                      { length: 8 },
                      (_, index) => Math.floor(octet / 2 ** (8 - 1 - index)) % 2,
                    )
                      .slice(nibbleIndex * 4, (nibbleIndex + 1) * 4)
                      .map((bit, bitIndex) => (
                        <div
                          key={bitIndex}
                          className={cn(
                            'shrink-0 overflow-hidden text-center',
                            bit ? 'text-tpl' : 'text-tpd',
                          )}
                          style={{
                            fontSize: `${fontSize}px`,
                            lineHeight: `${fontSize}px`,
                            width: bitWidth,
                          }}
                        >
                          {bit}
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <ul
        style={{ marginLeft: octetBitFieldPanelWidth }}
        onMouseLeave={() => setHighlightedBitIndex(-1)}
      >
        {finalDescriptionMap.map(([bitIndex, description]: [string, string], rowIndex: number) => {
          const bit = Number(bitIndex);

          const octetIndex = Math.floor(bit / 8);
          const nibbleIndex = Math.floor(bit / 4) % 2;
          const nibbleBitIndex = bit % 4;

          const octetBaseOffset = (8 * bitWidth + nibbleGap + octetGap) * octetIndex;
          const nibbleBaseOffset = (bitWidth * 4 + nibbleGap) * nibbleIndex;
          const bitOffset = nibbleBitIndex * bitWidth;

          const xDelta = xDeltaBias + octetBaseOffset + nibbleBaseOffset + bitOffset;
          const yDelta = yDeltaBias + rowIndex * lineHeight;

          const highlighted = highlightedBitIndex === bit;

          return (
            <li
              key={bitIndex}
              className="relative m-0 flex gap-2 text-nowrap p-0"
              style={{
                fontSize: `${fontSize}px`,
                lineHeight: `${lineHeight}px`,
              }}
            >
              {/* biome-ignore lint/a11y/noStaticElementInteractions: hovering a row cross-highlights the bit it names in the diagram above. The row carries the bit's own description as text, so nothing is reachable by hover alone. */}
              <div className="flex gap-2" onMouseEnter={() => setHighlightedBitIndex(bit)}>
                <div className={cn('flex gap-1', highlighted ? 'text-tok' : 'text-tpd')}>
                  {t('BitField.bitNoPrefix')}
                  <div className="mr-1 w-6 text-right">{`${bitIndex}: `}</div>
                </div>
                <div className={cn('truncate', highlighted ? 'text-tok' : 'text-tpl')}>
                  {description}
                </div>
              </div>
              <div
                className={cn(
                  'absolute border-b-2 border-l-2',
                  highlighted ? 'border-tok' : 'border-tpd',
                )}
                style={{
                  top: -lineHeight / 2 - yDelta,
                  left: -fontSize - 5 - xDelta,
                  width: fontSize + xDelta,
                  height: lineHeight + yDelta,
                }}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
