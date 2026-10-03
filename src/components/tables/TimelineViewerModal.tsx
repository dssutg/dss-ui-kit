import { useCallback, useId, useMemo, useRef, useState } from 'react';
import {
  type ActionKey,
  Chart,
  chartPosToCanvasRelative,
  chartViewKeyMap,
  chunkLines,
  formatChartHSL,
  getDefaultCanvasTransform,
  gridGap,
  MAX_SCALE,
  MIN_SCALE,
  type PlotFunctionRangeOptions,
  SCALE_FACTOR,
} from '@/components/charts/Chart';
import type { ZoomableCanvasTransform } from '@/components/charts/ZoomableCanvas';
import { Select } from '@/components/inputs/Select';
import { Modal } from '@/components/overlays/Modal';
import { useLocale } from '@/locale';
import { useTheme } from '@/theme';
import { useEventListener } from '@/util/hooks/use_event_listener';
import { useFullScreenChange } from '@/util/hooks/use_fullscreen_change';
import { handleKeyMapKeyDown, type KeyMapActions } from '@/util/key_map';
import { clamp, cmp } from '@/util/math';
import { useSearchSchemaPropertyValueToString } from './filterable_table_property_value';
import { formatDateAndTime } from './table_export';
import type {
  SearchPropertySchema,
  SearchPropertySchemaName,
  SearchSchema,
} from './use_filtered_items';

/**
 * Plots items against time, one series per value of a chosen property.
 *
 * The time axis comes from the schema's own date properties, and the series from any other property,
 * because a timeline of a single unchanging value says nothing. Rows whose time property is absent or
 * unparseable are skipped rather than plotted at the epoch.
 */
export interface TimelineViewerModalProps<T> {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly items: readonly T[];
  readonly searchSchema: SearchSchema<T>;
}

/**
 * A modal drawing the rows currently shown over time, one series per non-time property.
 *
 * The time axis comes from the schema's `dateAndTime` properties and the series from everything else,
 * so the same schema that makes the table searchable makes this drawable. Rows without a date are not
 * drawn: there is nowhere to put them on a time axis, and dropping them silently would be a lie about
 * the count.
 */
export function TimelineViewerModal<T>({
  open,
  onOpenChange,
  items,
  searchSchema,
}: TimelineViewerModalProps<T>) {
  const { t } = useLocale();

  const [statsPropertyName, setStatsPropertyName] = useState<
    SearchPropertySchemaName<T> | undefined
  >(
    // The first property that is not a time, since a timeline built from timestamps has no series to
    // show. A schema of nothing but times leaves nothing selected, which the modal renders as empty.
    () => searchSchema.properties.find((p) => p.type !== 'dateAndTime')?.name,
  );

  const id = useId();

  const property = useMemo(() => {
    return searchSchema.properties.find((p) => p.name === statsPropertyName);
  }, [searchSchema, statsPropertyName]);

  const timeProperty = useMemo(() => {
    return searchSchema.properties.find((p) => p.type === 'dateAndTime');
  }, [searchSchema]);

  return (
    <Modal
      open={open}
      title={t('TimelineViewerModal.title')}
      onOpenChange={onOpenChange}
      noWidthRestriction
    >
      {items.length !== 0 && (
        <div className="flex flex-col gap-2 mt-4">
          <div className="flex gap-2 items-center ml-auto">
            <label htmlFor={`${id}-property-select`} className="font-bold">
              {t('TimelineViewerModal.propertySelect.label')}
            </label>
            <Select
              id={`${id}-property-select`}
              value={statsPropertyName ?? ''}
              onChange={(e) =>
                setStatsPropertyName(e.currentTarget.value as typeof statsPropertyName)
              }
            >
              {searchSchema.properties
                .filter((property) => property.type !== 'dateAndTime')
                .map((property) => (
                  <option key={property.name} value={property.name}>
                    {property.label}
                  </option>
                ))}
            </Select>
          </div>
          {property !== undefined && timeProperty !== undefined && (
            <TimelineViewer items={items} property={property} timeProperty={timeProperty} />
          )}
        </div>
      )}
    </Modal>
  );
}

function TimelineViewer<T>({
  items,
  property,
  timeProperty,
}: {
  readonly items: readonly T[];
  readonly property: SearchPropertySchema<T>;
  readonly timeProperty: SearchPropertySchema<T>;
}) {
  const { dates } = useLocale();

  const searchSchemaPropertyValueToString = useSearchSchemaPropertyValueToString<T>();

  useTheme();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasTransform, setCanvasTransform] = useState<ZoomableCanvasTransform>(
    getDefaultCanvasTransform(),
  );
  const [gridVisible, setGridVisible] = useState(true);
  const [posLabelsVisible, setPosLabelsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const chartRef = useRef<HTMLDivElement>(null);

  useFullScreenChange(setIsFullscreen);

  const seekStart = useCallback(() => {
    setCanvasTransform((transform) => ({ ...transform, offsetX: 0 }));
  }, []);

  async function toggleFullscreen() {
    try {
      await (document.fullscreenElement
        ? document.exitFullscreen()
        : chartRef.current?.requestFullscreen());
    } catch (error) {
      console.error('Error toggling fullscreen:', error);
    }
  }

  function onTransformChange(transform: ZoomableCanvasTransform) {
    setCanvasTransform(transform);
  }

  function zoomIn() {
    const scale = clamp(canvasTransform.scale + SCALE_FACTOR, MIN_SCALE, MAX_SCALE);
    onTransformChange({ ...canvasTransform, scale });
  }

  function zoomOut() {
    const scale = clamp(canvasTransform.scale - SCALE_FACTOR, MIN_SCALE, MAX_SCALE);
    onTransformChange({ ...canvasTransform, scale });
  }

  function resetCanvasTransform() {
    setCanvasTransform(getDefaultCanvasTransform());
  }

  const chartDescriptor = useMemo(() => {
    const timeSet = new Set<number>();
    const propSet = new Set<string>();
    const timeSetPerProp: Record<string, Set<number>> = {};

    for (const item of items) {
      const prop = searchSchemaPropertyValueToString(item, property);
      const time = Number(timeProperty.extractValue(item));

      timeSet.add(time);
      propSet.add(prop);
      // Initialised here rather than read back, so the set being filled is the one stored.
      const timesForProp = timeSetPerProp[prop] ?? new Set<number>();

      timesForProp.add(time);
      timeSetPerProp[prop] = timesForProp;
    }

    const sortedTimePoints = [...timeSet].sort(cmp);

    const reverseSortedProps = [...propSet].sort((a, b) => -cmp(a, b));

    const color = formatChartHSL([42, 100, 67]);

    function getTimeStampAtX(x: number) {
      return sortedTimePoints[(x - chunkLines) / chunkLines];
    }

    const lastX = (sortedTimePoints.length - 1) * chunkLines + chunkLines;

    function propIndexToY(propIndex: number) {
      return propIndex * chunkLines + chunkLines;
    }

    function yToPropIndex(y: number) {
      return (y - chunkLines) / chunkLines;
    }

    const functionsToPlot: PlotFunctionRangeOptions[] = reverseSortedProps.map(
      (prop, propIndex) => ({
        type: 'point',
        color,
        pointSize: gridGap / 2,
        getPointY: (x) => {
          const timestamp = getTimeStampAtX(x);

          if (timestamp === undefined) {
            return undefined;
          }

          if (timeSetPerProp[prop]?.has(timestamp) !== true) {
            return undefined;
          }

          return propIndexToY(propIndex);
        },
      }),
    );

    function getXLabel(x: number): string {
      const timestamp = getTimeStampAtX(x);

      if (timestamp === undefined) {
        return '';
      }

      return formatDateAndTime(timestamp, dates);
    }

    function getYLabel(y: number): string {
      const propLabel = reverseSortedProps[yToPropIndex(y)];

      return propLabel?.toString() ?? '';
    }

    return {
      functionsToPlot,
      getXLabel,
      getYLabel,
      lastX,
    };
  }, [items, property, timeProperty, dates, searchSchemaPropertyValueToString]);

  function seekEnd() {
    setCanvasTransform((transform) => {
      const canvasWidth = canvasRef.current?.width ?? 0;
      const canvasHeight = canvasRef.current?.height ?? 0;

      const lastX = Math.max(chartDescriptor.lastX);

      const lastXCanvasRelative = chartPosToCanvasRelative(transform, canvasHeight, lastX, 0).x;

      const scaledGridGap = gridGap * transform.scale;

      const offsetX =
        lastXCanvasRelative < canvasWidth
          ? transform.offsetX
          : canvasWidth - (lastX + chunkLines) * scaledGridGap;

      return { ...transform, offsetX };
    });
  }

  const noAction = useCallback(() => {}, []);

  const toggleGrid = useCallback(() => {
    setGridVisible((visible) => !visible);
  }, []);

  const togglePosLabels = useCallback(() => {
    setPosLabelsVisible((visible) => !visible);
  }, []);

  const actionMap: KeyMapActions<ActionKey> = {
    toggleGrid,
    toggleHighlights: noAction,
    togglePosLabels,
    zoomIn,
    zoomOut,
    resetCanvasTransform,
    toggleFullscreen,
    startStopOscilloscope: noAction,
    clearChart: noAction,
    seekStart,
    seekEnd,
    seekLeft: noAction,
    seekRight: noAction,
    seekLeftLarge: noAction,
    seekRightLarge: noAction,
    goToPreviousProblem: noAction,
    goToNextProblem: noAction,
    openGoToPointDialog: noAction,
    openChartMarkerManager: noAction,
  };

  useEventListener('keydown', (e: KeyboardEvent) => {
    if (!open) {
      return;
    }
    handleKeyMapKeyDown<ActionKey>(chartViewKeyMap, actionMap, e);
  });

  return (
    <Chart
      chartRef={chartRef}
      canvasRef={canvasRef}
      canvasTransform={canvasTransform}
      onTransformChange={onTransformChange}
      functionsToPlot={chartDescriptor.functionsToPlot}
      gridVisible={gridVisible}
      setGridVisible={setGridVisible}
      posLabelsVisible={posLabelsVisible}
      setPosLabelsVisible={setPosLabelsVisible}
      zoomIn={zoomIn}
      zoomOut={zoomOut}
      resetCanvasTransform={resetCanvasTransform}
      isFullscreen={isFullscreen}
      toggleFullscreen={toggleFullscreen}
      seekStart={seekStart}
      seekEnd={seekEnd}
      getXLabel={chartDescriptor.getXLabel}
      getYLabel={chartDescriptor.getYLabel}
      className="bg-bocb relative flex-grow rounded-2xl w-screen max-w-full"
      style={{ height: 600 }}
    />
  );
}
