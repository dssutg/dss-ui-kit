/**
 * The public surface of the DSS UI Kit.
 *
 * This module is the only thing a consumer imports. Everything reachable from here is part of the
 * library's promise; everything else under `src/` is an implementation detail that may change in
 * any release. A consumer that reaches past this file is depending on something the version number
 * does not describe.
 *
 * ```ts
 * import { Button, LocaleProvider, setTheme } from 'dss-ui-kit';
 * import 'dss-ui-kit/style.css';
 * ```
 *
 * The stylesheet is a separate export rather than an import here. JSR type-checks the package with
 * Deno, which cannot read a CSS module, so the side-effect import is one line the source cannot
 * spell — and a component library that injected its own CSS on import would make the order it
 * loads in significant anyway. The caller decides when the theme and the utilities land.
 *
 * ## What is deliberately not exported
 *
 * The library is a design system and a set of presentational components. It has no data layer and no
 * router, and it names no application's subject matter: a component renders the shape it is handed.
 * Anything a caller would otherwise have to reach into their own application for is a prop.
 */

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
  ButtonGroupProps,
} from '@/components/buttons/ButtonGroup';
export { ButtonGroup } from '@/components/buttons/ButtonGroup';
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
export type { AlphaColorPickerProperties } from '@/components/color-picker/AlphaColorPicker';
export { AlphaColorPicker } from '@/components/color-picker/AlphaColorPicker';
export type { ColorInputProperties } from '@/components/color-picker/ColorInput';
export { ColorInput } from '@/components/color-picker/ColorInput';
export type { ColorPickerProperties } from '@/components/color-picker/ColorPicker';
export { ColorPicker } from '@/components/color-picker/ColorPicker';
export type {
  AnyColor,
  ColorModel,
  ColorPickerBaseProperties,
  HslaColor,
  HslColor,
  HsvaColor,
  HsvColor,
  ObjectColor,
  RgbaColor,
  RgbColor,
} from '@/components/color-picker/color_picker_types';
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
export type { IconName, ShippedIconName } from '@/components/display/Icon';
export { Icon } from '@/components/display/Icon';
export { IconedSectionTitle } from '@/components/display/IconedSectionTitle';
export { IconViewer } from '@/components/display/IconViewer';
export type { LightRayOverlayProps } from '@/components/display/LightRayOverlay';
export { LightRayOverlay } from '@/components/display/LightRayOverlay';
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
export type {
  CommandConsoleCommand,
  CommandConsoleContext,
  CommandConsoleProps,
} from '@/components/feedback/CommandConsole';
export { CommandConsole } from '@/components/feedback/CommandConsole';
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
export type { InputProps } from '@/components/inputs/Input';
export { Input } from '@/components/inputs/Input';
export { IPInput } from '@/components/inputs/IPInput';
export { JsonEditor } from '@/components/inputs/JsonEditor';
export { LockableToggleSwitch } from '@/components/inputs/LockableToggleSwitch';
export { SearchInput } from '@/components/inputs/SearchInput';
export { Select } from '@/components/inputs/Select';
export { Slider } from '@/components/inputs/Slider';
export type { SocketServerAddressInputProps } from '@/components/inputs/SocketServerAddressInput';
export { SocketServerAddressInput } from '@/components/inputs/SocketServerAddressInput';
export { TextInput } from '@/components/inputs/TextInput';
export type { TimePartInputProps } from '@/components/inputs/TimePartInput';
export { TimePartInput } from '@/components/inputs/TimePartInput';
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
export type {
  AutoSizerProps,
  AutoSizerState,
  BaseProps,
  HeightAndWidthProps,
  HeightOnlyProps,
  HorizontalSize,
  Size,
  VerticalSize,
  WidthOnlyProps,
} from '@/components/layout/AutoSizer';

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
export { NAV_BAR_BREADCRUMB_SEPARATOR, NavBar } from '@/components/navigation/NavBar';
export { OrderPanel } from '@/components/navigation/OrderPanel';
export type { RouteDescriptor, RouteSwitchProps } from '@/components/navigation/RouteSwitch';
export { RouteSwitch } from '@/components/navigation/RouteSwitch';
export { SlideMenu } from '@/components/navigation/SlideMenu';
export { ToTop } from '@/components/navigation/ToTop';
export type { ColorIndicator, TreeViewItem } from '@/components/navigation/TreeView';

export { TreeView } from '@/components/navigation/TreeView';
export { ConfirmationModal } from '@/components/overlays/ConfirmationModal';
export type { DropDownMenuItem } from '@/components/overlays/DropDownMenu';
export { DropDownMenu } from '@/components/overlays/DropDownMenu';
export type { FeedbackTooltipType } from '@/components/overlays/FeedbackTooltip';
export { FeedbackTooltip, showFeedbackTooltip } from '@/components/overlays/FeedbackTooltip';
export { Modal } from '@/components/overlays/Modal';
export { Popover } from '@/components/overlays/Popover';
export { ColumnResizer } from '@/components/tables/ColumnResizer';
export type { ControlledFilterableTableProps } from '@/components/tables/ControlledFilterableTable';
export { ControlledFilterableTable } from '@/components/tables/ControlledFilterableTable';
export type { ControlledTableProps } from '@/components/tables/ControlledTable';
export { ControlledTable, getEnumLabel } from '@/components/tables/ControlledTable';
export type { CountLabelProps } from '@/components/tables/CountLabel';
export { CountLabel } from '@/components/tables/CountLabel';
export type {
  FilterableTableColumnProperty,
  FilterableTableContext,
  FilterableTableFilterProperty,
  FilterableTableProperty,
  FilterableTablePropertyList,
  FilterableTableProps,
} from '@/components/tables/FilterableTable';
export { FilterableTable } from '@/components/tables/FilterableTable';
export type { FilterableTableStatsModalProps } from '@/components/tables/FilterableTableStatsModal';
export { FilterableTableStatsModal } from '@/components/tables/FilterableTableStatsModal';
export type { EnumOption } from '@/components/tables/FilterableTableTopPanel';
export { FilterableTableTopPanel } from '@/components/tables/FilterableTableTopPanel';
export type { GeneralizedSearchModalProps } from '@/components/tables/GeneralizedSearchModal';
export { GeneralizedSearchModal } from '@/components/tables/GeneralizedSearchModal';
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
export type { TimelineViewerModalProps } from '@/components/tables/TimelineViewerModal';
export { TimelineViewerModal } from '@/components/tables/TimelineViewerModal';
export type {
  FilterableTableExportFormat,
  GetExportedTableFilenameCallback,
} from '@/components/tables/table_export';
export type {
  AnonymousSearchPropertySchema,
  SearchPropertySchema,
  SearchSchema,
} from '@/components/tables/use_filtered_items';
export { useFilteredItems } from '@/components/tables/use_filtered_items';
export type { IconPath } from '@/icons/registry';
export {
  getIconNames,
  getIconPath,
  hasIcon,
  registerIcon,
  registerIcons,
  unregisterIcon,
} from '@/icons/registry';
export type { LocaleDates } from '@/locales/dates';
export { tryCatch, tryCatchAsync } from '@/util/catch';
export { cn } from '@/util/cn';
export type { RGBA32, RGBA32BreakPoint } from '@/util/color';
export { getCSSVariableValue, Rgba32Gradient } from '@/util/color';
export type { CalendarLocale, DateFormatLocale, DateLocale, DateNames } from '@/util/date';
export { formatRelativeDate, getDateComponents } from '@/util/date';
export { parseCSV, parseDSV, serializeCSV, serializeDSV } from '@/util/dsv';
export { downloadStringAsPlainTextFile, formatByteSize } from '@/util/file';
export { formatHexNumber } from '@/util/format';
export { fuzzySearch } from '@/util/fuzzy_search';
export type { BoxFaceName, GLQuad } from '@/util/gl/geometry';
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
} from '@/util/gl/geometry';
export type { ProgramInfo, SceneRenderContext } from '@/util/gl/renderer';
export {
  createSceneRenderContext,
  deleteSceneRenderContext,
  renderScene,
  useGLCtx,
} from '@/util/gl/renderer';
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
} from '@/util/gl/scene';
export type { Lang } from '@/util/highlight';
export { highlightText } from '@/util/highlight';
export { useDebounce } from '@/util/hooks/use_debounce';
export { useDelayedVisibility } from '@/util/hooks/use_delayed_visibility';
export { useDocumentScrollPercentage } from '@/util/hooks/use_document_scroll_percentage';
export type {
  DraggableListItemProps,
  DragNDropOrderedList,
} from '@/util/hooks/use_drag_n_drop_ordered_list';
export { useDragNDropOrderedList } from '@/util/hooks/use_drag_n_drop_ordered_list';
export type { DraggablePanelRefs } from '@/util/hooks/use_draggable_panel';
export {
  DEFAULT_DRAG_START_EDGE_WIDTH,
  useDraggablePanel,
} from '@/util/hooks/use_draggable_panel';
export { useElementSize } from '@/util/hooks/use_element_size';
export type { EventListenerCallback } from '@/util/hooks/use_event_listener';
export { useEventListener } from '@/util/hooks/use_event_listener';
export { useForceUpdate } from '@/util/hooks/use_force_update';
export type { OnFullScreenChangeCallback } from '@/util/hooks/use_fullscreen_change';
export { useFullScreenChange } from '@/util/hooks/use_fullscreen_change';
export { useGranularEffect } from '@/util/hooks/use_granular_effect';
export type { HookWithDependencies } from '@/util/hooks/use_granular_hook';
export { useGranularHook } from '@/util/hooks/use_granular_hook';
export { useImmediateInterval, useInterval } from '@/util/hooks/use_interval';
export { minDesktopWidth, useIsMobileScreen } from '@/util/hooks/use_is_mobile_screen';
export { useMouseDrag } from '@/util/hooks/use_mouse_drag';
export { useOutsideComponentClick } from '@/util/hooks/use_outside_component_click';
export { usePreventAccidentalPageClose } from '@/util/hooks/use_prevent_accidental_page_close';
export { usePropertyRef } from '@/util/hooks/use_property_ref';
export { useScrollbarWidth } from '@/util/hooks/use_scrollbar_width';
export { useSyncScroll } from '@/util/hooks/use_sync_scroll';
export { useTimeout } from '@/util/hooks/use_timeout';
export { useWindowSize } from '@/util/hooks/use_window_size';
export type { HttpStatus, HttpStatusCategory } from '@/util/http';
export { getHttpStatusCategory, getHttpStatusCategoryName, getHttpStatusName } from '@/util/http';
export { ipv4Regex, parseIp } from '@/util/ipv4';
export type { KeyMap, KeyMapActions, KeyMapHandler } from '@/util/key_map';
export { getKeyMapCodeAsHotkey, handleKeyMapKeyDown } from '@/util/key_map';
export type { Point2D } from '@/util/math/angle';
export type { Mat4 } from '@/util/math/matrix';
export { Vector3D } from '@/util/math/vector3d';
export type { PluralRule } from '@/util/pluralization';
export { getPluralizationIndex, registerPluralRule } from '@/util/pluralization';
export type {
  PathDispatchEntry,
  PathDispatchMap,
  PathDispatchResult,
  PathDispatchTable,
  PathMatch,
} from '@/util/routing';
export {
  buildPath,
  dispatchPath,
  dispatchPathMap,
  escapePathComponent,
  getPathDepth,
  getPathParam,
  isChildPath,
  matchPath,
  parsePathComponents,
} from '@/util/routing';
export { uuidv4 } from '@/util/uuid';
export type { VError, VSchema, VValidator } from '@/util/validator';
export { vArray, vBoolean, vInt, vNumber, vString } from '@/util/validator';
export { compareVersions } from '@/util/version';
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
  mergeCatalogues,
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
