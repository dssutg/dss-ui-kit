export function inViewport(element: Readonly<HTMLElement>) {
  const { top, bottom, left, right } = element.getBoundingClientRect();

  return (
    top >= 0 &&
    left >= 0 &&
    bottom <= (window.innerHeight ?? document.documentElement.clientHeight) &&
    right <= (window.innerWidth ?? document.documentElement.clientWidth)
  );
}

export function scrollToElement(element: HTMLElement, bias: number, smooth: boolean) {
  const elementRect = element.getBoundingClientRect();
  const bodyRect = document.body.getBoundingClientRect();
  const offset = elementRect.top - bodyRect.top - bias;
  const behavior = smooth ? 'smooth' : 'instant';

  window.scrollTo({ top: offset, left: 0, behavior });
}

export function DOMRectContainsPoint(rect: Readonly<DOMRect>, x: number, y: number): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

export function areDOMRectsEqual(rect1: DOMRect, rect2: DOMRect): boolean {
  return (
    rect1 === rect2 ||
    (rect1.left === rect2.left &&
      rect1.top === rect2.top &&
      rect1.right === rect2.right &&
      rect1.bottom === rect2.bottom &&
      rect1.width === rect2.width &&
      rect1.height === rect2.height)
  );
}
