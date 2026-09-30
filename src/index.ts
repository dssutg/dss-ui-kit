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
import '@/css/index.css';

/* -------------------------------------------------------------------------------------------- */
/* Components                                                                                     */
/* -------------------------------------------------------------------------------------------- */

export type { ActionKey } from '@/chart';
export { Chart, type ChartProps, chartViewKeyMap, type PlotFunctionRangeOptions } from '@/chart';
export type {
  AnonymousSearchPropertySchema,
  ControlledFilterableTableProps,
  EnumOption,
  FilterableTableColumnProperty,
  FilterableTableContext,
  FilterableTableExportFormat,
  FilterableTableFilterProperty,
  FilterableTableProperty,
  FilterableTablePropertyList,
  FilterableTableProps,
  FilterableTableTopPanel,
  GetExportedTableFilenameCallback,
  SearchPropertySchema,
  SearchSchema,
} from '@/filterable_table';
export { ControlledFilterableTable, FilterableTable, useFilteredItems } from '@/filterable_table';
export type {
  DeviceTypeLookup,
  Rack,
  RackDatabaseColumns,
  RackDevice,
  RackDeviceRef,
  RackDeviceTypeDescriptor,
  RackDeviceVariant,
  RackPanel,
  RackPanelName,
  ServerRackEditorProps,
  ServerRackViewProps,
} from '@/server_rack';
export { ServerRackView, SeverRackEditor } from '@/server_rack';
export type { EditableAccordionListItem } from '@/ui/accordion';
export { Accordion, EditableAccordionList, useAccordion } from '@/ui/accordion';
export { BitField } from '@/ui/bitfield';
export type {
  ButtonGroupItem,
  ButtonGroupItemChangeHandler,
  ButtonType,
  LinkProps,
  ToggleButtonOption,
  ToggleButtonProps,
} from '@/ui/button';
export {
  Button,
  CopyToClipboardButton,
  IconButton,
  IconedButtonGroup,
  Link,
  ToggleButton,
  ToTop,
} from '@/ui/button';
export { MiniCalendar, StaticCalendar } from '@/ui/calendar';
export { Checkbox, LockableToggleSwitch, ToggleSwitch } from '@/ui/checkbox';
export {
  HexAlphaColorPickerPopover,
  HslaStringColorPickerPopover,
} from '@/ui/color_popover';
export { ColorfulYesNo } from '@/ui/colorful_yes_no';
export type { DropDownButtonVariant, DropDownMenuItem } from '@/ui/dropdown';
export { DropDownButton, DropDownMenu } from '@/ui/dropdown';
export type { FeedbackTooltipType } from '@/ui/feedback_tooltip';
export { FeedbackTooltip, showFeedbackTooltip } from '@/ui/feedback_tooltip';
export type { IconName } from '@/ui/icon';
export { Icon, IconViewer } from '@/ui/icon';
export { IconedSectionTitle } from '@/ui/iconed_section_title';
export type { DecimalIntegerInputValue } from '@/ui/input';
export {
  ByteFractionInput,
  DecimalIntegerInput,
  DelayedInput,
  FloatInput,
  HighlightedJson,
  HourMinuteSecondTimeInput,
  HourMinuteTimeInput,
  Input,
  IPInput,
  JsonEditor,
  LogOutputTextArea,
  LogWidget,
  SearchInput,
  SocketServerAddressInput,
  TextInput,
  UnsignedIntegerInput,
} from '@/ui/input';
export { Modal } from '@/ui/modal';
export { OrderPanel } from '@/ui/order_panel';
export type { PieChartShare } from '@/ui/piechart';
export { getShareColor, getSharePercent, mapToShares, PieChart } from '@/ui/piechart';
export { Popover } from '@/ui/popover';
export { ResizableSplit } from '@/ui/resizer';
export { RingProgress } from '@/ui/ring_progress';
export { Ripple } from '@/ui/ripple';
export { ScrollProgressBar } from '@/ui/scroll_progress_bar';
export { Select } from '@/ui/select';
export { SimpleLineChart } from '@/ui/simple_line_chart';
export { Slider } from '@/ui/slider';
export type {
  SortableTableCellDescriptor,
  SortableTableCellRenderer,
  SortableTableCellRendererContext,
  SortableTableColumnComparatorTable,
  SortableTableColumnRenderMap,
  SortableTableComparatorFunction,
  SortableTableDescriptor,
  SortableTableHeaderColumn,
  SortableTableRow,
  SortableTableRowDescriptor,
} from '@/ui/sortable_table';
export { ColumnResizer, makeSortableTableCellRenderer, SortableTable } from '@/ui/sortable_table';
export { ContinuousCircleSpinner, DashedCircle, Spinner, WshSpinner } from '@/ui/spinner';
export type { MUITabDescriptor } from '@/ui/tab_list';
export { ControlledMUITabList, isMUITabActive, MUITabList } from '@/ui/tab_list';
export type {
  IsOnPathToCurrentItem,
  MenuTreeItemClickCallback,
  MenuTreeItemClickHandlerResult,
  MenuTreeItemContextMenuCallback,
  TMenuTreeItem,
  TreeViewItem,
} from '@/ui/tree';
export { MenuTree, TreeView } from '@/ui/tree';
export type { UploadConfigProps } from '@/ui/upload_config';
export { UploadConfig } from '@/ui/upload_config';
export { minDesktopWidth, useIsMobileScreen } from '@/ui/use_is_mobile_screen';
export type {
  ZoomableCanvasDrawCallbackProps,
  ZoomableCanvasTransform,
} from '@/ui/zoomable_canvas';
export { ZoomableCanvas } from '@/ui/zoomable_canvas';

/* -------------------------------------------------------------------------------------------- */
/* Infrastructure                                                                                */
/* -------------------------------------------------------------------------------------------- */

export type {
  CrashGuardProps,
  CrashReport,
  CrashReportContact,
  CrashReportQueue,
  CrashReportSubmitter,
} from '@/crash';
export {
  AppCrashGuard,
  clearCachedCrashReports,
  crashReportCacheKey,
  crashReportQueueKey,
  readCachedCrashReports,
} from '@/crash';
export type { EventTypes } from '@/event';
export {
  emitEvent,
  emitTypedEvent,
  onEvent,
  useEvent,
  useTypedEvent,
  useTypedEventData,
} from '@/event';
export type { FeatureDescriptor, FeatureName, FeatureToggleEvent } from '@/feature_flag';
export {
  getAllFeatureFlags,
  isFeatureEnabled,
  registerFeatureFlag,
  setFeatureEnabled,
  toggleFeature,
  unregisterFeatureFlag,
  useFeatureFlag,
} from '@/feature_flag';
export type {
  LocaleContextValue,
  LocaleName,
  LocaleProviderProps,
  MessageCatalogue,
  MessageKey,
  MessageParameters,
} from '@/locale';
export {
  builtinCatalogues,
  fallbackLocale,
  getLocaleDates,
  getLocaleName,
  isLocaleWithCyrillicScript,
  isLocaleWithRtlScript,
  LOCALE_STORAGE_KEY,
  LocaleProvider,
  supportedLocales,
  translate,
  useLocale,
} from '@/locale';
export type { BuiltinThemeName, ThemeDescriptor, ThemeName } from '@/theme';
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
} from '@/theme';

/* -------------------------------------------------------------------------------------------- */
/* Hooks and framework-agnostic helpers                                                          */
/* -------------------------------------------------------------------------------------------- */

export { AutoSizer } from '@/lib/autosizer';
export { tryCatch, tryCatchAsync } from '@/lib/catch';
export { getCSSVariableValue } from '@/lib/color';
export { formatRelativeDate, getDateComponents } from '@/lib/date';
export { parseCSV, parseDSV, serializeCSV, serializeDSV } from '@/lib/dsv';
export { downloadStringAsPlainTextFile, formatByteSize } from '@/lib/file';
export { formatHexNumber } from '@/lib/format_number';
export { fuzzySearch } from '@/lib/fuzzy_search';
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
