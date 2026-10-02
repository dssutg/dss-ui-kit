export { copyToClipboard } from '@/lib/dom_clipboard';
export { DragHandler } from '@/lib/dom_drag';
export { decompressJSON } from '@/lib/dom_encoding';
export { hasUserFocusedInput, onBackdropClick } from '@/lib/dom_focus';
export {
  areDOMRectsEqual,
  DOMRectContainsPoint,
  inViewport,
  scrollToElement,
} from '@/lib/dom_geometry';
export { escapeHTMLValue, html, sanitizeHTMLString, templ } from '@/lib/dom_html';
export { firstTouch, getPointerPosition } from '@/lib/dom_pointer';
export { getDpr, getResponsiveSize } from '@/lib/dom_sizing';
export { debounce } from '@/lib/dom_timing';
export type { EventCallback, WCAttrChange } from '@/lib/dom_web_component';
export { WComponent } from '@/lib/dom_web_component';
