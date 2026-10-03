/**
 * The largest square side that fits `squaresToFit` squares into a container, rounded down to an
 * integer.
 *
 * The answer is searched over the two ways of laying a grid out — more columns than rows and more
 * rows than columns — and the better of the two wins, which is why neither `cols` nor `rows` on its
 * own is the answer. A value below one for `squaresToFit` is treated as one, so a caller that has
 * nothing to lay out yet still gets a size rather than a division by zero.
 *
 * The result is floored so a caller multiplying it back out never overflows the container; the
 * remainder is left as an unfilled strip rather than clipped squares.
 */
export function calculateSquareSizeFittingContainer(
  containerWidth: number,
  containerHeight: number,
  squaresToFit: number,
) {
  // Derived from chubakueno's answer:
  //   https://math.stackexchange.com/questions/466198/algorithm-to-get-the-maximum-size-of-n-squares-that-fit-into-a-rectangle-with-a
  const w = containerWidth;
  const h = containerHeight;
  const n = Math.max(1, squaresToFit);

  const containerArea = w * h;
  const maxCellArea = containerArea / n;
  const maxCellSize = Math.sqrt(maxCellArea);

  const cols = Math.ceil(w / maxCellSize);
  const rows = Math.ceil(h / maxCellSize);

  const actualCellSizeXCase = w / cols;
  const actualCellSizeYCase = h / rows;

  const fittingRows = h / actualCellSizeXCase;
  const fittingCols = w / actualCellSizeYCase;

  const xCaseArea = Math.floor(fittingRows) * cols;
  const yCaseArea = Math.floor(fittingCols) * rows;

  const xCaseAreaFits = xCaseArea >= n;
  const yCaseAreaFits = yCaseArea >= n;

  const finalXCaseCellSize = xCaseAreaFits ? actualCellSizeXCase : h / Math.ceil(fittingRows);
  const finalYCaseCellSize = yCaseAreaFits ? actualCellSizeYCase : w / Math.ceil(fittingCols);

  const cellSizeCoveringMaxArea = Math.max(finalXCaseCellSize, finalYCaseCellSize);

  const finalCellSize = Math.floor(cellSizeCoveringMaxArea);

  return finalCellSize;
}

/**
 * An axis-aligned rectangle in whole units.
 *
 * Bounds are read as start-inclusive, end-exclusive: {@link containsPoint} accepts the start but not
 * the end, which is how a cell at `x + width` correctly belongs to the next rectangle. The
 * `ExcludingStartBoundary` and `ExcludingEndBoundary` accessors exist for the rarer whole-unit
 * reading where the shared edge itself must stay outside; do not reach for the ordinary accessors
 * in that case.
 *
 * The class is a value, but `Rectangle` stays mutable: copying is one explicit {@link copy} away,
 * and an in-place update is sometimes the cheaper shape for a caller that folds results into a
 * rectangle it already holds.
 */
export class Rectangle {
  public x: number;
  public y: number;
  public width: number;
  public height: number;

  /** The unit rectangle at the origin — the identity for the transformations the callers do. */
  static getIdentity(): Rectangle {
    return new Rectangle(0, 0, 1, 1);
  }

  constructor(x: number, y: number, width: number, height: number) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  copy() {
    return new Rectangle(this.x, this.y, this.width, this.height);
  }

  area() {
    return this.width * this.height;
  }

  perimeter() {
    return 2 * (this.width + this.height);
  }

  getStartPoint() {
    return { x: this.x, y: this.y };
  }

  /**
   * The start corner moved one unit inside — the first whole unit the rectangle covers.
   *
   * For a rectangle at the edge of a grid this is the first position that is fully inside rather
   * than touching the boundary, which is the distinction the callers that walk a grid cell by cell
   * care about.
   */
  getStartPointExcludingStartBoundary() {
    return { x: this.x + 1, y: this.y + 1 };
  }

  getEndPoint() {
    return { x: this.x + this.width, y: this.y + this.height };
  }

  /** The end corner moved one unit inside — the last whole unit fully inside the rectangle. */
  getEndPointExcludingEndBoundary() {
    return { x: this.x + this.width - 1, y: this.y + this.height - 1 };
  }

  /**
   * The centre relative to the rectangle's own origin, not in parent space.
   *
   * Add the start point to it to get the centre in world coordinates.
   */
  center() {
    return { x: this.width / 2, y: this.height / 2 };
  }

  hypot() {
    return Math.hypot(this.width, this.height);
  }

  toString() {
    return `Rectangle(x=${this.x}, y=${this.y}, width=${this.width}, height=${this.height})`;
  }

  equals(other: Rectangle) {
    return (
      this.x === other.x &&
      this.y === other.y &&
      this.width === other.width &&
      this.height === other.height
    );
  }

  /**
   * Whether the point lies inside, start-inclusive and end-exclusive.
   *
   * A zero-width or zero-height rectangle therefore contains no point at all, which makes the empty
   * rectangle a valid value rather than a degenerate case to special-case.
   */
  containsPoint(pointX: number, pointY: number) {
    return (
      pointX >= this.x &&
      pointX < this.x + this.width &&
      pointY >= this.y &&
      pointY < this.y + this.height
    );
  }

  /** Whether `other` lies wholly inside this one, sharing edges allowed. */
  contains(other: Rectangle) {
    return (
      other.x >= this.x &&
      other.x + other.width <= this.x + this.width &&
      other.y >= this.y &&
      other.y + other.height <= this.y + this.height
    );
  }

  /**
   * Whether the two rectangles touch at all.
   *
   * Touching counts as intersecting because the comparison uses `<=` and `>=` on the edges, so a
   * caller that wants area overlap and not adjacency has to shrink one of the two before asking.
   */
  intersects(other: Rectangle) {
    return (
      other.x <= this.x + this.width &&
      other.x + other.width >= this.x &&
      other.y <= this.y + this.height &&
      other.y + other.height >= this.y
    );
  }
}
