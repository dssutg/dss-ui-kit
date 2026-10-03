/**
 * Browser-facing DOM helpers: pointer and drag handling, geometry, sizing, clipboard, escaping and
 * timing.
 *
 * Everything here is plain DOM logic with no framework dependency, so it can be used from both
 * components and non-component code; see each module's own docs for the contracts.
 */
export { copyToClipboard } from './clipboard';
export { DragHandler } from './drag';
export { decompressJSON } from './encoding';
export { hasUserFocusedInput, onBackdropClick } from './focus';
export {
  areDOMRectsEqual,
  DOMRectContainsPoint,
  inViewport,
  scrollToElement,
} from './geometry';
export { escapeHTMLValue, html, sanitizeHTMLString, templ } from './html';
export { firstTouch, getPointerPosition } from './pointer';
export { getDpr, getResponsiveSize } from './sizing';
export { debounce } from './timing';
export type { EventCallback, WCAttrChange } from './web_component';
export { WComponent } from './web_component';
