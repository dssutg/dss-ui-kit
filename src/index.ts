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
import '@/index.css';

/* -------------------------------------------------------------------------------------------- */
/* Components                                                                                     */
/* -------------------------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------------------------- */
/* Infrastructure                                                                                */
/* -------------------------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------------------------- */
/* Hooks and framework-agnostic helpers                                                          */
/* -------------------------------------------------------------------------------------------- */

export type {
  CrashGuardProps,
  CrashReport,
  CrashReportContact,
  CrashReportQueue,
  CrashReportSubmitter,
} from '@/AppCrashGuard';
export {
  AppCrashGuard,
  clearCachedCrashReports,
  crashReportCacheKey,
  crashReportQueueKey,
  readCachedCrashReports,
} from '@/AppCrashGuard';
export type { ActionKey } from '@/Chart';
export { Chart, type ChartProps, chartViewKeyMap, type PlotFunctionRangeOptions } from '@/Chart';
export type { ControlledFilterableTableProps } from '@/ControlledFilterableTable';
export { ControlledFilterableTable } from '@/ControlledFilterableTable';
export type { EventTypes } from '@/event';
export {
  emitEvent,
  emitTypedEvent,
  onEvent,
  useEvent,
  useTypedEvent,
  useTypedEventData,
} from '@/event';
export type {
  FilterableTableColumnProperty,
  FilterableTableContext,
  FilterableTableFilterProperty,
  FilterableTableProperty,
  FilterableTablePropertyList,
  FilterableTableProps,
} from '@/FilterableTable';
export { FilterableTable } from '@/FilterableTable';
export type { EnumOption } from '@/FilterableTableTopPanel';
export { FilterableTableTopPanel } from '@/FilterableTableTopPanel';
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
  FilterableTableExportFormat,
  GetExportedTableFilenameCallback,
} from '@/filterable_table_export';
export type {
  AnonymousSearchPropertySchema,
  SearchPropertySchema,
  SearchSchema,
} from '@/filterable_table_search';
export { useFilteredItems } from '@/filterable_table_search';
export { AutoSizer } from '@/lib/AutoSizer';
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
export type {
  LocaleContextValue,
  LocaleDefinition,
  LocaleName,
  LocaleProviderProps,
  LocaleScript,
  MessageCatalogue,
  MessageKey,
  MessageParameters,
} from '@/locale';
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
export { Accordion, useAccordion } from '@/ui/Accordion';
export { BitField } from '@/ui/BitField';
export type { ButtonType } from '@/ui/Button';
export { Button } from '@/ui/Button';
export type { ButtonGroupItem, ButtonGroupItemChangeHandler } from '@/ui/ButtonGroup';
export { ByteFractionInput } from '@/ui/ByteFractionInput';
export { Checkbox } from '@/ui/Checkbox';
export { ColorfulYesNo } from '@/ui/ColorfulYesNo';
export { ColumnResizer } from '@/ui/ColumnResizer';
export { ContinuousCircleSpinner } from '@/ui/ContinuousCircleSpinner';
export { ControlledMUITabList } from '@/ui/ControlledMUITabList';
export { CopyToClipboardButton } from '@/ui/CopyToClipboardButton';
export type {
  AlphaColorPickerProperties,
  ColorInputProperties,
  ColorPickerProperties,
} from '@/ui/color_picker_components';
export { AlphaColorPicker, ColorInput, ColorPicker } from '@/ui/color_picker_components';
export { DashedCircle } from '@/ui/DashedCircle';
export type { DecimalIntegerInputValue } from '@/ui/DecimalIntegerInput';
export { DecimalIntegerInput } from '@/ui/DecimalIntegerInput';
export { DelayedInput } from '@/ui/DelayedInput';
export type { DropDownButtonVariant } from '@/ui/DropDownButton';
export { DropDownButton } from '@/ui/DropDownButton';
export type { DropDownMenuItem } from '@/ui/DropDownMenu';
export { DropDownMenu } from '@/ui/DropDownMenu';
export type { EditableAccordionListItem } from '@/ui/EditableAccordionList';
export { EditableAccordionList } from '@/ui/EditableAccordionList';
export type { FeedbackTooltipType } from '@/ui/FeedbackTooltip';
export { FeedbackTooltip, showFeedbackTooltip } from '@/ui/FeedbackTooltip';
export { HexAlphaColorPicker } from '@/ui/HexAlphaColorPicker';
export { HexAlphaColorPickerPopover } from '@/ui/HexAlphaColorPickerPopover';
export type { HexColorInputProperties } from '@/ui/HexColorInput';
export { HexColorInput } from '@/ui/HexColorInput';
export { HexColorPicker } from '@/ui/HexColorPicker';
export { HighlightedJson } from '@/ui/HighlightedJson';
export { HourMinuteSecondTimeInput } from '@/ui/HourMinuteSecondTimeInput';
export { HourMinuteTimeInput } from '@/ui/HourMinuteTimeInput';
export { HslaColorPicker } from '@/ui/HslaColorPicker';
export { HslaStringColorPicker } from '@/ui/HslaStringColorPicker';
export { HslaStringColorPickerPopover } from '@/ui/HslaStringColorPickerPopover';
export type { IconName } from '@/ui/Icon';
export { Icon } from '@/ui/Icon';
export { IconButton } from '@/ui/IconButton';
export { IconedButtonGroup } from '@/ui/IconedButtonGroup';
export { IconedSectionTitle } from '@/ui/IconedSectionTitle';
export { IconViewer } from '@/ui/IconViewer';
export { Input } from '@/ui/Input';
export { IPInput } from '@/ui/IPInput';
export { JsonEditor } from '@/ui/JsonEditor';
export type { LinkProps } from '@/ui/Link';
export { Link } from '@/ui/Link';
export { LockableToggleSwitch } from '@/ui/LockableToggleSwitch';
export { LogOutputTextArea } from '@/ui/LogOutputTextArea';
export { LogWidget } from '@/ui/LogWidget';
export type {
  IsOnPathToCurrentItem,
  MenuTreeItemClickCallback,
  MenuTreeItemClickHandlerResult,
  MenuTreeItemContextMenuCallback,
  TMenuTreeItem,
} from '@/ui/MenuTree';
export { MenuTree } from '@/ui/MenuTree';
export { MiniCalendar } from '@/ui/MiniCalendar';
export { Modal } from '@/ui/Modal';
export type { MUITabDescriptor } from '@/ui/MUITabList';
export { isMUITabActive, MUITabList } from '@/ui/MUITabList';
export { OrderPanel } from '@/ui/OrderPanel';
export type { PieChartShare } from '@/ui/PieChart';
export { getShareColor, getSharePercent, mapToShares, PieChart } from '@/ui/PieChart';
export { Popover } from '@/ui/Popover';
export { ResizableSplit } from '@/ui/ResizableSplit';
export { RgbaColorPicker } from '@/ui/RgbaColorPicker';
export { RgbaStringColorPicker } from '@/ui/RgbaStringColorPicker';
export { RingProgress } from '@/ui/RingProgress';
export { Ripple } from '@/ui/Ripple';
export { ScrollProgressBar } from '@/ui/ScrollProgressBar';
export { SearchInput } from '@/ui/SearchInput';
export { Select } from '@/ui/Select';
export { SimpleLineChart } from '@/ui/SimpleLineChart';
export { Slider } from '@/ui/Slider';
export { SocketServerAddressInput } from '@/ui/SocketServerAddressInput';
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
} from '@/ui/SortableTable';
export { makeSortableTableCellRenderer, SortableTable } from '@/ui/SortableTable';
export type { SortableTableRow } from '@/ui/SortableTableRow';
export { Spinner } from '@/ui/Spinner';
export { StaticCalendar } from '@/ui/StaticCalendar';
export { TextInput } from '@/ui/TextInput';
export type { ToggleButtonOption, ToggleButtonProps } from '@/ui/ToggleButton';
export { ToggleButton } from '@/ui/ToggleButton';
export { ToggleSwitch } from '@/ui/ToggleSwitch';
export { ToTop } from '@/ui/ToTop';
export type { TreeViewItem } from '@/ui/TreeView';
export { TreeView } from '@/ui/TreeView';
export { UnsignedIntegerInput } from '@/ui/UnsignedIntegerInput';
export type { UploadConfigProps } from '@/ui/UploadConfig';
export { UploadConfig } from '@/ui/UploadConfig';
export { minDesktopWidth, useIsMobileScreen } from '@/ui/use_is_mobile_screen';
export { WshSpinner } from '@/ui/WshSpinner';
export type { ZoomableCanvasDrawCallbackProps, ZoomableCanvasTransform } from '@/ui/ZoomableCanvas';
export { ZoomableCanvas } from '@/ui/ZoomableCanvas';
