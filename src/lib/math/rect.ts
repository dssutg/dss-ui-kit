// Calculates the optimal side of squares to be fit into the
// container rectangle. Returns the optimal side of the fitted squares.
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

export class Rectangle {
  public x: number;
  public y: number;
  public width: number;
  public height: number;

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

  getStartPointExcludingStartBoundary() {
    return { x: this.x + 1, y: this.y + 1 };
  }

  getEndPoint() {
    return { x: this.x + this.width, y: this.y + this.height };
  }

  getEndPointExcludingEndBoundary() {
    return { x: this.x + this.width - 1, y: this.y + this.height - 1 };
  }

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

  containsPoint(pointX: number, pointY: number) {
    return (
      pointX >= this.x &&
      pointX < this.x + this.width &&
      pointY >= this.y &&
      pointY < this.y + this.height
    );
  }

  contains(other: Rectangle) {
    return (
      other.x >= this.x &&
      other.x + other.width <= this.x + this.width &&
      other.y >= this.y &&
      other.y + other.height <= this.y + this.height
    );
  }

  intersects(other: Rectangle) {
    return (
      other.x <= this.x + this.width &&
      other.x + other.width >= this.x &&
      other.y <= this.y + this.height &&
      other.y + other.height >= this.y
    );
  }
}
