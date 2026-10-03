/**
 * The public surface of the DSS UI Kit.
 *
 * This module is the only thing a consumer imports. Everything reachable from here is part of the
 * library's promise; everything else under `src/` is an implementation detail that may change in
 * any release. A consumer that reaches past this file is depending on something the version number
 * does not describe.
 *
 * ```ts
 * import { Button, LocaleProvider, ThemeProvider } from 'dss-ui-kit';
 * import 'dss-ui-kit/style.css';
 * ```
 *
 * The stylesheet is imported by name rather than from here, because a component library that
 * injected its own CSS on import would make the order it loads in significant. The caller decides
 * when the theme and the utilities land.
 *
 * ## What is deliberately not exported
 *
 * The library is a design system and a set of presentational components. It has no domain model, no
 * data layer and no router, and it does not carry the vocabulary of the application it was extracted
 * from. A component takes props, and anything a caller would otherwise have to reach into the
 * application for is a prop.
 */

// The one global stylesheet: the Tailwind entry point, the themes, and the base resets. Shipped as
// `dss-ui-kit/style.css` rather than imported here, so the caller controls when it applies.
import './index.css';

/* -------------------------------------------------------------------------------------------- */
/* Components                                                                                     */
/* -------------------------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------------------------- */
/* Infrastructure                                                                                */
/* -------------------------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------------------------- */
/* Hooks and framework-agnostic helpers                                                          */
/* -------------------------------------------------------------------------------------------- */

export type { ButtonType } from '@/components/buttons/Button';
export { Button } from '@/components/buttons/Button';
export type {
  ButtonGroupItem,
  ButtonGroupItemChangeHandler,
} from '@/components/buttons/ButtonGroup';
export { CopyToClipboardButton } from '@/components/buttons/CopyToClipboardButton';
export type { DropDownButtonVariant } from '@/components/buttons/DropDownButton';
export { DropDownButton } from '@/components/buttons/DropDownButton';
export { IconButton } from '@/components/buttons/IconButton';
export { IconedButtonGroup } from '@/components/buttons/IconedButtonGroup';
export type { PlayPauseButtonProps } from '@/components/buttons/PlayPauseButton';
export { PlayPauseButton } from '@/components/buttons/PlayPauseButton';
export type { ToggleButtonOption, ToggleButtonProps } from '@/components/buttons/ToggleButton';
export { ToggleButton } from '@/components/buttons/ToggleButton';
export type { ActionKey } from '@/components/charts/Chart';
export {
  Chart,
  type ChartProps,
  chartViewKeyMap,
  type PlotFunctionRangeOptions,
} from '@/components/charts/Chart';
export { MiniCalendar } from '@/components/charts/MiniCalendar';
export type { PieChartShare } from '@/components/charts/PieChart';
export {
  getShareColor,
  getSharePercent,
  mapToShares,
  PieChart,
} from '@/components/charts/PieChart';
export { RingProgress } from '@/components/charts/RingProgress';
export { SimpleLineChart } from '@/components/charts/SimpleLineChart';
export { StaticCalendar } from '@/components/charts/StaticCalendar';
export type {
  ZoomableCanvasDrawCallbackProps,
  ZoomableCanvasTransform,
} from '@/components/charts/ZoomableCanvas';
export { ZoomableCanvas } from '@/components/charts/ZoomableCanvas';
export type {
  AlphaColorPickerProperties,
  ColorInputProperties,
  ColorPickerProperties,
} from '@/components/color-picker/color_picker_components';
export {
  AlphaColorPicker,
  ColorInput,
  ColorPicker,
} from '@/components/color-picker/color_picker_components';
export { HexAlphaColorPicker } from '@/components/color-picker/HexAlphaColorPicker';
export { HexAlphaColorPickerPopover } from '@/components/color-picker/HexAlphaColorPickerPopover';
export type { HexColorInputProperties } from '@/components/color-picker/HexColorInput';
export { HexColorInput } from '@/components/color-picker/HexColorInput';
export { HexColorPicker } from '@/components/color-picker/HexColorPicker';
export { HslaColorPicker } from '@/components/color-picker/HslaColorPicker';
export { HslaStringColorPicker } from '@/components/color-picker/HslaStringColorPicker';
export { HslaStringColorPickerPopover } from '@/components/color-picker/HslaStringColorPickerPopover';
export { RgbaColorPicker } from '@/components/color-picker/RgbaColorPicker';
export { RgbaStringColorPicker } from '@/components/color-picker/RgbaStringColorPicker';
export { HighlightedJson } from '@/components/display/HighlightedJson';
export type { IconName } from '@/components/display/Icon';
export { Icon } from '@/components/display/Icon';
export { IconedSectionTitle } from '@/components/display/IconedSectionTitle';
export { IconViewer } from '@/components/display/IconViewer';
export type { LinkProps } from '@/components/display/Link';
export { Link } from '@/components/display/Link';
export type {
  CrashGuardProps,
  CrashReport,
  CrashReportContact,
  CrashReportQueue,
  CrashReportSubmitter,
} from '@/components/feedback/AppCrashGuard';
export {
  AppCrashGuard,
  clearCachedCrashReports,
  crashReportCacheKey,
  crashReportQueueKey,
  readCachedCrashReports,
} from '@/components/feedback/AppCrashGuard';
export { ContinuousCircleSpinner } from '@/components/feedback/ContinuousCircleSpinner';
export { DashedCircle } from '@/components/feedback/DashedCircle';
export { LogOutputTextArea } from '@/components/feedback/LogOutputTextArea';
export { LogWidget } from '@/components/feedback/LogWidget';
export { Ripple } from '@/components/feedback/Ripple';
export { ScrollProgressBar } from '@/components/feedback/ScrollProgressBar';
export { Spinner } from '@/components/feedback/Spinner';
export { WshSpinner } from '@/components/feedback/WshSpinner';
export { BitField } from '@/components/inputs/BitField';
export { ByteFractionInput } from '@/components/inputs/ByteFractionInput';
export { Checkbox } from '@/components/inputs/Checkbox';
export { ColorfulYesNo } from '@/components/inputs/ColorfulYesNo';
export type { DecimalIntegerInputValue } from '@/components/inputs/DecimalIntegerInput';
export { DecimalIntegerInput } from '@/components/inputs/DecimalIntegerInput';
export { DelayedInput } from '@/components/inputs/DelayedInput';
export type { FloatInputProps } from '@/components/inputs/FloatInput';
export { FloatInput } from '@/components/inputs/FloatInput';
export { HourMinuteSecondTimeInput } from '@/components/inputs/HourMinuteSecondTimeInput';
export { HourMinuteTimeInput } from '@/components/inputs/HourMinuteTimeInput';
export { Input } from '@/components/inputs/Input';
export { IPInput } from '@/components/inputs/IPInput';
export { JsonEditor } from '@/components/inputs/JsonEditor';
export { LockableToggleSwitch } from '@/components/inputs/LockableToggleSwitch';
export { SearchInput } from '@/components/inputs/SearchInput';
export { Select } from '@/components/inputs/Select';
export { Slider } from '@/components/inputs/Slider';
export { SocketServerAddressInput } from '@/components/inputs/SocketServerAddressInput';
export { TextInput } from '@/components/inputs/TextInput';
export { ToggleSwitch } from '@/components/inputs/ToggleSwitch';
export { UnsignedIntegerInput } from '@/components/inputs/UnsignedIntegerInput';
export type { UploadConfigProps } from '@/components/inputs/UploadConfig';
export { UploadConfig } from '@/components/inputs/UploadConfig';
export type {
  UseVirtualizedListOptions,
  UseVirtualizedListResult,
  VirtualizedListProps,
  VirtualizedListRowRendererProps,
} from '@/components/inputs/VirtualizedList';
export { useVirtualizedList, VirtualizedList } from '@/components/inputs/VirtualizedList';
export { AutoSizer } from '@/components/layout/AutoSizer';
export { ResizableSplit } from '@/components/layout/ResizableSplit';
export { Accordion, useAccordion } from '@/components/navigation/Accordion';
export { ControlledMUITabList } from '@/components/navigation/ControlledMUITabList';
export type { EditableAccordionListItem } from '@/components/navigation/EditableAccordionList';
export { EditableAccordionList } from '@/components/navigation/EditableAccordionList';
export type {
  IsOnPathToCurrentItem,
  MenuTreeItemClickCallback,
  MenuTreeItemClickHandlerResult,
  MenuTreeItemContextMenuCallback,
  TMenuTreeItem,
} from '@/components/navigation/MenuTree';
export { MenuTree } from '@/components/navigation/MenuTree';
export type { MUITabDescriptor } from '@/components/navigation/MUITabList';
export { isMUITabActive, MUITabList } from '@/components/navigation/MUITabList';
export { OrderPanel } from '@/components/navigation/OrderPanel';
export { ToTop } from '@/components/navigation/ToTop';
export type { TreeViewItem } from '@/components/navigation/TreeView';
export { TreeView } from '@/components/navigation/TreeView';
export type { DropDownMenuItem } from '@/components/overlays/DropDownMenu';
export { DropDownMenu } from '@/components/overlays/DropDownMenu';
export type { FeedbackTooltipType } from '@/components/overlays/FeedbackTooltip';
export { FeedbackTooltip, showFeedbackTooltip } from '@/components/overlays/FeedbackTooltip';
export { Modal } from '@/components/overlays/Modal';
export { Popover } from '@/components/overlays/Popover';
export { ColumnResizer } from '@/components/tables/ColumnResizer';
export type { ControlledFilterableTableProps } from '@/components/tables/ControlledFilterableTable';
export { ControlledFilterableTable } from '@/components/tables/ControlledFilterableTable';
export type {
  FilterableTableColumnProperty,
  FilterableTableContext,
  FilterableTableFilterProperty,
  FilterableTableProperty,
  FilterableTablePropertyList,
  FilterableTableProps,
} from '@/components/tables/FilterableTable';
export { FilterableTable } from '@/components/tables/FilterableTable';
export type { EnumOption } from '@/components/tables/FilterableTableTopPanel';
export { FilterableTableTopPanel } from '@/components/tables/FilterableTableTopPanel';
export type {
  FilterableTableExportFormat,
  GetExportedTableFilenameCallback,
} from '@/components/tables/filterable_table_export';
export type { ControlledTableProps } from '@/components/tables/filterable_table_internal';
export { ControlledTable, getEnumLabel } from '@/components/tables/filterable_table_internal';
export type {
  AnonymousSearchPropertySchema,
  SearchPropertySchema,
  SearchSchema,
} from '@/components/tables/filterable_table_search';
export { useFilteredItems } from '@/components/tables/filterable_table_search';
export type { GeneralizedSearchModalProps } from '@/components/tables/filterable_table_search_modal';
export { GeneralizedSearchModal } from '@/components/tables/filterable_table_search_modal';
export type {
  CountLabelProps,
  FilterableTableStatsModalProps,
} from '@/components/tables/filterable_table_stats';
export { CountLabel, FilterableTableStatsModal } from '@/components/tables/filterable_table_stats';
export type { TimelineViewerModalProps } from '@/components/tables/filterable_table_timeline';
export { TimelineViewerModal } from '@/components/tables/filterable_table_timeline';
export type {
  SortableTableCellDescriptor,
  SortableTableCellRenderer,
  SortableTableCellRendererContext,
  SortableTableColumnComparatorTable,
  SortableTableColumnRenderMap,
  SortableTableComparatorFunction,
  SortableTableDescriptor,
  SortableTableHeaderColumn,
  SortableTableRowDescriptor,
} from '@/components/tables/SortableTable';
export { makeSortableTableCellRenderer, SortableTable } from '@/components/tables/SortableTable';
export type { SortableTableRow } from '@/components/tables/SortableTableRow';
export { tryCatch, tryCatchAsync } from '@/lib/catch';
export { getCSSVariableValue, Rgba32Gradient } from '@/lib/color';
export { formatRelativeDate, getDateComponents } from '@/lib/date';
export { parseCSV, parseDSV, serializeCSV, serializeDSV } from '@/lib/dsv';
export { downloadStringAsPlainTextFile, formatByteSize } from '@/lib/file';
export { formatHexNumber } from '@/lib/format_number';
export { fuzzySearch } from '@/lib/fuzzy_search';
export type { BoxFaceName, GLQuad } from '@/lib/gl/geometry';
export {
  calcNormal,
  convertBoxToQuads,
  convertHexColorToGL,
  flattenSceneObjects,
  generateTransformMatrices,
  getBoxCropUV,
  getCameraWorldPos,
  getFaceColor,
  getMaterialByHexColor,
  isPointInsideBox,
  makeTransformationMatrix,
  makeTransformedVertex,
  naiveRaycast,
} from '@/lib/gl/geometry';
export type { ProgramInfo, SceneRenderContext } from '@/lib/gl/renderer';
export {
  createSceneRenderContext,
  deleteSceneRenderContext,
  renderScene,
  useGLCtx,
} from '@/lib/gl/renderer';
export type {
  BoxFaceColors,
  BoxSceneObject,
  Camera,
  FontCharacterInfo,
  FontCharacterMap,
  FontRenderInfo,
  GLQuadUV,
  GroupSceneObject,
  ObjectMaterial,
  QuadSceneObject,
  Scene,
  SceneObject,
  TextSceneObject,
  Vector2Array,
  Vector3Array,
  Vector4Array,
} from '@/lib/gl/scene';
export { highlightText } from '@/lib/highlight';
export { getHttpStatusCategory, getHttpStatusCategoryName, getHttpStatusName } from '@/lib/http';
export { ipv4Regex, parseIp } from '@/lib/ipv4';
export type { KeyMap, KeyMapActions, KeyMapHandler } from '@/lib/key_map';
export { getKeyMapCodeAsHotkey, handleKeyMapKeyDown } from '@/lib/key_map';
export type { PluralRule } from '@/lib/pluralization';
export { getPluralizationIndex, registerPluralRule } from '@/lib/pluralization';
export { useDebounce } from '@/lib/use_debounce';
export { useDelayedVisibility } from '@/lib/use_delayed_visibility';
export { useDocumentScrollPercentage } from '@/lib/use_document_scroll_percentage';
export { useDragNDropOrderedList } from '@/lib/use_drag_n_drop_ordered_list';
export { useElementSize } from '@/lib/use_element_size';
export { useEventListener } from '@/lib/use_event_listener';
export { useForceUpdate } from '@/lib/use_force_update';
export { useFullScreenChange } from '@/lib/use_fullscreen_change';
export { useGranularEffect } from '@/lib/use_granular_effect';
export { useGranularHook } from '@/lib/use_granular_hook';
export { useImmediateInterval, useInterval } from '@/lib/use_interval';
export { minDesktopWidth, useIsMobileScreen } from '@/lib/use_is_mobile_screen';
export { useMouseDrag } from '@/lib/use_mouse_drag';
export { useOutsideComponentClick } from '@/lib/use_outside_component_click';
export { usePreventAccidentalPageClose } from '@/lib/use_prevent_accidental_page_close';
export { usePropertyRef } from '@/lib/use_property_ref';
export { useScrollbarWidth } from '@/lib/use_scrollbar_width';
export { useSyncScroll } from '@/lib/use_sync_scroll';
export { useTimeout } from '@/lib/use_timeout';
export { useWindowSize } from '@/lib/use_window_size';
export { uuidv4 } from '@/lib/uuid';
export type { VError, VSchema, VValidator } from '@/lib/validator';
export { vArray, vBoolean, vInt, vNumber, vString } from '@/lib/validator';
export type { EventTypes } from './event';
export {
  emitEvent,
  emitTypedEvent,
  onEvent,
  useEvent,
  useTypedEvent,
  useTypedEventData,
} from './event';
export type { FeatureDescriptor, FeatureName, FeatureToggleEvent } from './feature_flag';
export {
  getAllFeatureFlags,
  isFeatureEnabled,
  registerFeatureFlag,
  setFeatureEnabled,
  toggleFeature,
  unregisterFeatureFlag,
  useFeatureFlag,
} from './feature_flag';
export type {
  LocaleContextValue,
  LocaleDefinition,
  LocaleName,
  LocaleProviderProps,
  LocaleScript,
  MessageCatalogue,
  MessageKey,
  MessageParameters,
} from './locale';
export {
  builtinCatalogues,
  fallbackLocale,
  getLocaleDates,
  getLocaleDefinition,
  getLocaleName,
  isLocaleWithCyrillicScript,
  isLocaleWithRtlScript,
  LOCALE_STORAGE_KEY,
  LocaleProvider,
  registerLocale,
  supportedLocales,
  translate,
  useLocale,
} from './locale';
export type { BuiltinThemeName, ThemeDescriptor, ThemeName } from './theme';
export {
  builtinThemeNames,
  builtinThemes,
  defaultTheme,
  getAllThemes,
  getCurrentTheme,
  isThemeName,
  registerTheme,
  setTheme,
  THEME_ATTRIBUTE,
  THEME_STORAGE_KEY,
  useTheme,
} from './theme';
