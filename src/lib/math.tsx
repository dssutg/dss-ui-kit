// Clamp a value between min and max inclusively
export function clamp(value: number, min: number, max: number) {
	return Math.max(min, Math.min(max, value));
}

export function lerp(min: number, max: number, progress: number) {
	return (1 - progress) * min + progress * max;
}

export function unlerp(min: number, max: number, value: number) {
	return (value - min) / (max - min);
}

export function lerpRange(
	min0: number,
	max0: number,
	min1: number,
	max1: number,
	value: number,
) {
	const progress = unlerp(min0, max0, value);

	return lerp(min1, max1, progress);
}

// This function computes the modulo of n (left operand)
// and m (right operand). However, this function also
// considers negative operands and wraps the result number
// accordingly that is returned.
export function modulo(a: number, b: number) {
	return ((a % b) + b) % b;
}

export function wrapIndex(index: number, length: number) {
	if (length === 0) {
		return 0;
	}
	return modulo(index, length);
}

export function step(x: number, threshold: number) {
	if (x >= threshold) {
		return 1;
	}
	return 0;
}

export function smoothStep(x: number, edge0: number, edge1: number) {
	const t = clamp(unlerp(edge0, edge1, x), 0, 1);

	return t * t * (3 - 2 * t);
}

export interface Point2D {
	x: number;
	y: number;
}

export const turn = 2 * Math.PI;

export function degreesToRadians(radians: number) {
	return (radians * Math.PI) / 180;
}

export function radiansToDegrees(radians: number) {
	return (radians * 180) / Math.PI;
}

export function normalizeRadians(radians: number) {
	return modulo(radians, turn);
}

export function getMinDistanceBetweenRadians(angle1: number, angle2: number) {
	const a = angle1 % turn;
	const b = angle2 % turn;

	const difference = Math.abs(a - b);

	const minDistance = Math.min(difference, turn - difference);

	return minDistance;
}

export function polarToCartesian(angle: number, radius: number): Point2D {
	const x = radius * Math.cos(angle);
	const y = radius * Math.sin(angle);
	return { x, y };
}

export function cartesianToPolar(x: number, y: number) {
	const angle = normalizeRadians(Math.atan2(y, x));
	const radius = Math.hypot(y, x);
	return { angle, radius };
}

export function rotatePoint2D(point: Point2D, angle: number) {
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);
	const x = point.x * cos - point.y * sin;
	const y = point.x * sin + point.y * cos;
	return { x, y };
}

export function bezier3d(points: readonly Vector3D[], t: number): Vector3D {
	const n = points.length - 1;

	let result = Vector3D.ZERO;

	for (const [i, point] of points.entries()) {
		const binomialCoefficient = binomial(n, i);
		const term = binomialCoefficient * (1 - t) ** (n - i) * t ** i;

		result = result.add(point.scaleScalar(term));
	}

	return result;
}

export function bezier2d(points: readonly Vector2D[], t: number): Vector2D {
	const mapTo3D = ({ x, y }: Vector2D) => new Vector3D(x, y, 0);

	return Vector2D.fromPoint2D(bezier3d(points.map(mapTo3D), t));
}

export function binomial(n: number, k: number): number {
	if (k < 0 || k > n) {
		return 0;
	}

	if (k === 0 || k === n) {
		return 1;
	}

	let coefficient = 1;

	for (let i = 1; i <= k; i++) {
		coefficient = (coefficient * (n - i + 1)) / i;
	}

	return coefficient;
}

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

	const finalXCaseCellSize = xCaseAreaFits
		? actualCellSizeXCase
		: h / Math.ceil(fittingRows);
	const finalYCaseCellSize = yCaseAreaFits
		? actualCellSizeYCase
		: w / Math.ceil(fittingCols);

	const cellSizeCoveringMaxArea = Math.max(
		finalXCaseCellSize,
		finalYCaseCellSize,
	);

	const finalCellSize = Math.floor(cellSizeCoveringMaxArea);

	return finalCellSize;
}

// This function compares the arguments a and b, and
// returns -1 if a < b, 1 if a > b, and 0 if a == b.
// Useful for sorting comparators.
export function cmp<T>(a: T, b: T) {
	if (a > b) {
		return 1;
	} else if (a < b) {
		return -1;
	}
	return 0;
}

export function naturalCmp(a: string, b: string): number {
	const regex = /(\d+|\D+)/g;

	const aSegments = a.match(regex) ?? [];
	const bSegments = b.match(regex) ?? [];

	const maxSegments = Math.max(aSegments.length, bSegments.length);

	for (let i = 0; i < maxSegments; i++) {
		const aSegment = aSegments[i] ?? "";
		const bSegment = bSegments[i] ?? "";

		const aIsNumber = /^\d+$/.test(aSegment);
		const bIsNumber = /^\d+$/.test(bSegment);

		if (aIsNumber && bIsNumber) {
			const aNumber = parseInt(aSegment, 10);
			const bNumber = parseInt(bSegment, 10);

			if (aNumber !== bNumber) {
				return cmp(aNumber, bNumber);
			}
		} else if (aSegment !== bSegment) {
			return aSegment.localeCompare(bSegment);
		}
	}

	return 0;
}

export interface Range {
	start: number;
	end: number;
}

// This function returns a sorted list in ascending order of merged ranges
export function mergeRanges<T extends Range>(ranges: readonly T[]): T[] {
	// Sort the ranges based on `start`
	const sortedRanges = ranges.toSorted((a, b) => cmp(a.start, b.start));

	let merged: T[] = [];

	for (const range of sortedRanges) {
		const lastMerge = merged[merged.length - 1];

		// If merged is empty or the current range does not overlap with the last one, add it
		if (lastMerge === undefined || lastMerge.end < range.start) {
			merged = [...merged, range];
		} else {
			// There is an overlap, so merge the current range with the last one
			lastMerge.end = Math.max(lastMerge.end, range.end);
		}
	}

	return merged;
}

export function mergeIntegers(array: readonly number[]): Range[] {
	const sorted = array.toSorted((a, b) => cmp(a, b));

	if (sorted.length === 0) {
		return [];
	}

	let merged: Range[] = [];

	let start = sorted[0]!;
	let end = sorted[0]!;

	for (let i = 1; i < sorted.length; i++) {
		const element = sorted[i]!;

		if (element !== end + 1) {
			merged = [...merged, { start, end }];
			start = element;
		}

		end = element;
	}

	merged = [...merged, { start, end }];

	return merged;
}

// IMPORTANT: OpenGL stores matrices and vectors in COLUMN-major order
// so namely columns are stored contiguously in memory.
export function glMat4Identity() {
	return new Float32Array([
		1, 0, 0, 0,

		0, 1, 0, 0,

		0, 0, 1, 0,

		0, 0, 0, 1,
	]);
}

export function glMat4Perspective(
	out: Float32Array,
	fovY: number,
	aspect: number,
	near: number,
	far = Infinity,
) {
	const f = 1 / Math.tan(fovY / 2);

	out[0] = f / aspect;
	out[1] = 0;
	out[2] = 0;
	out[3] = 0;

	out[4] = 0;
	out[5] = f;
	out[6] = 0;
	out[7] = 0;

	out[8] = 0;
	out[9] = 0;
	out[11] = -1;

	out[12] = 0;
	out[13] = 0;
	out[15] = 0;

	if (far !== undefined && far !== Infinity) {
		const nf = 1 / (near - far);

		out[10] = (far + near) * nf;
		out[14] = 2 * far * near * nf;
	} else {
		out[10] = -1;
		out[14] = -2 * near;
	}

	return out;
}

// Generates a orthogonal projection matrix with the given bounds
//
// @param {mat4} out mat4 frustum matrix will be written into
// @param {number} left Left bound of the frustum
// @param {number} right Right bound of the frustum
// @param {number} bottom Bottom bound of the frustum
// @param {number} top Top bound of the frustum
// @param {number} near Near bound of the frustum
// @param {number} far Far bound of the frustum
// @returns {mat4} out
export function gltMat4Ortho(
	out: Float32Array,
	{
		left,
		right,
		bottom,
		top,
		near,
		far,
	}: {
		readonly left: number;
		readonly right: number;
		readonly bottom: number;
		readonly top: number;
		readonly near: number;
		readonly far: number;
	},
) {
	const lr = 1 / (left - right);
	const bt = 1 / (bottom - top);
	const nf = 1 / (near - far);

	out[0] = -2 * lr;
	out[1] = 0;
	out[2] = 0;
	out[3] = 0;

	out[4] = 0;
	out[5] = -2 * bt;
	out[6] = 0;
	out[7] = 0;

	out[8] = 0;
	out[9] = 0;
	out[10] = 2 * nf;
	out[11] = 0;

	out[12] = (left + right) * lr;
	out[13] = (top + bottom) * bt;
	out[14] = (far + near) * nf;
	out[15] = 1;

	return out;
}

export function transpose(out: Float32Array, a: Float32Array) {
	// If we are transposing ourselves we can skip a few steps but have to cache some values
	if (out === a) {
		const a01 = a[1]!;
		const a02 = a[2]!;
		const a03 = a[3]!;
		const a12 = a[6]!;
		const a13 = a[7]!;
		const a23 = a[11]!;

		out[1] = a[4]!;
		out[2] = a[8]!;
		out[3] = a[12]!;
		out[4] = a01;
		out[6] = a[9]!;
		out[7] = a[13]!;
		out[8] = a02;
		out[9] = a12;
		out[11] = a[14]!;
		out[12] = a03;
		out[13] = a13;
		out[14] = a23;
	} else {
		out[0] = a[0]!;
		out[1] = a[4]!;
		out[2] = a[8]!;
		out[3] = a[12]!;
		out[4] = a[1]!;
		out[5] = a[5]!;
		out[6] = a[9]!;
		out[7] = a[13]!;
		out[8] = a[2]!;
		out[9] = a[6]!;
		out[10] = a[10]!;
		out[11] = a[14]!;
		out[12] = a[3]!;
		out[13] = a[7]!;
		out[14] = a[11]!;
		out[15] = a[15]!;
	}

	return out;
}

export function glMat4Translate(
	out: Float32Array,
	a: Readonly<Float32Array>,
	v: Readonly<Float32Array>,
): Float32Array {
	const x = v[0]!;
	const y = v[1]!;
	const z = v[2]!;

	if (a === out) {
		out[12] = a[0]! * x + a[4]! * y + a[8]! * z + a[12]!;
		out[13] = a[1]! * x + a[5]! * y + a[9]! * z + a[13]!;
		out[14] = a[2]! * x + a[6]! * y + a[10]! * z + a[14]!;
		out[15] = a[3]! * x + a[7]! * y + a[11]! * z + a[15]!;
	} else {
		const a00 = a[0]!;
		const a01 = a[1]!;
		const a02 = a[2]!;
		const a03 = a[3]!;
		const a10 = a[4]!;
		const a11 = a[5]!;
		const a12 = a[6]!;
		const a13 = a[7]!;
		const a20 = a[8]!;
		const a21 = a[9]!;
		const a22 = a[10]!;
		const a23 = a[11]!;

		out[0] = a00;
		out[1] = a01;
		out[2] = a02;
		out[3] = a03;

		out[4] = a10;
		out[5] = a11;
		out[6] = a12;
		out[7] = a13;

		out[8] = a20;
		out[9] = a21;
		out[10] = a22;
		out[11] = a23;

		out[12] = a00 * x + a10 * y + a20 * z + a[12]!;
		out[13] = a01 * x + a11 * y + a21 * z + a[13]!;
		out[14] = a02 * x + a12 * y + a22 * z + a[14]!;
		out[15] = a03 * x + a13 * y + a23 * z + a[15]!;
	}

	return out;
}

export function glMat4Rotate(
	out: Float32Array,
	a: Readonly<Float32Array>,
	rad: number,
	axis: Readonly<[number, number, number]>,
): Float32Array | null {
	let x = axis[0]!;
	let y = axis[1]!;
	let z = axis[2]!;

	let length = Math.hypot(x, y, z);

	const EPSILON = 0.000_001;

	if (length < EPSILON) {
		return null;
	}

	length = 1 / length;

	x = x * length;
	y = y * length;
	z = z * length;

	const s = Math.sin(rad);
	const c = Math.cos(rad);
	const t = 1 - c;

	const a00 = a[0]!;
	const a01 = a[1]!;
	const a02 = a[2]!;
	const a03 = a[3]!;

	const a10 = a[4]!;
	const a11 = a[5]!;
	const a12 = a[6]!;
	const a13 = a[7]!;

	const a20 = a[8]!;
	const a21 = a[9]!;
	const a22 = a[10]!;
	const a23 = a[11]!;

	// Construct the elements of the rotation matrix
	const b00 = x * x * t + c;
	const b01 = y * x * t + z * s;
	const b02 = z * x * t - y * s;

	const b10 = x * y * t - z * s;
	const b11 = y * y * t + c;
	const b12 = z * y * t + x * s;

	const b20 = x * z * t + y * s;
	const b21 = y * z * t - x * s;
	const b22 = z * z * t + c;

	// Perform rotation-specific matrix multiplication
	out[0] = a00 * b00 + a10 * b01 + a20 * b02;
	out[1] = a01 * b00 + a11 * b01 + a21 * b02;
	out[2] = a02 * b00 + a12 * b01 + a22 * b02;
	out[3] = a03 * b00 + a13 * b01 + a23 * b02;
	out[4] = a00 * b10 + a10 * b11 + a20 * b12;
	out[5] = a01 * b10 + a11 * b11 + a21 * b12;
	out[6] = a02 * b10 + a12 * b11 + a22 * b12;
	out[7] = a03 * b10 + a13 * b11 + a23 * b12;
	out[8] = a00 * b20 + a10 * b21 + a20 * b22;
	out[9] = a01 * b20 + a11 * b21 + a21 * b22;
	out[10] = a02 * b20 + a12 * b21 + a22 * b22;
	out[11] = a03 * b20 + a13 * b21 + a23 * b22;

	if (a !== out) {
		// If the source and destination differ, copy the unchanged last row
		out[12] = a[12]!;
		out[13] = a[13]!;
		out[14] = a[14]!;
		out[15] = a[15]!;
	}

	return out;
}

export function glMat4Scale(
	out: Float32Array,
	a: Readonly<Float32Array>,
	v: Readonly<[number, number, number]>,
) {
	const x = v[0]!;
	const y = v[1]!;
	const z = v[2]!;

	out[0] = a[0]! * x;
	out[1] = a[1]! * x;
	out[2] = a[2]! * x;
	out[3] = a[3]! * x;

	out[4] = a[4]! * y;
	out[5] = a[5]! * y;
	out[6] = a[6]! * y;
	out[7] = a[7]! * y;

	out[8] = a[8]! * z;
	out[9] = a[9]! * z;
	out[10] = a[10]! * z;
	out[11] = a[11]! * z;

	out[12] = a[12]!;
	out[13] = a[13]!;
	out[14] = a[14]!;
	out[15] = a[15]!;

	return out;
}

// Multiply two 4x4 matrices
export function glMat4Multiply(
	out: Float32Array,
	a: Readonly<Float32Array>,
	b: Readonly<Float32Array>,
) {
	const a00 = a[0]!;
	const a01 = a[1]!;
	const a02 = a[2]!;
	const a03 = a[3]!;

	const a10 = a[4]!;
	const a11 = a[5]!;
	const a12 = a[6]!;
	const a13 = a[7]!;

	const a20 = a[8]!;
	const a21 = a[9]!;
	const a22 = a[10]!;
	const a23 = a[11]!;

	const a30 = a[12]!;
	const a31 = a[13]!;
	const a32 = a[14]!;
	const a33 = a[15]!;

	const b00 = b[0]!;
	const b01 = b[1]!;
	const b02 = b[2]!;
	const b03 = b[3]!;

	const b10 = b[4]!;
	const b11 = b[5]!;
	const b12 = b[6]!;
	const b13 = b[7]!;

	const b20 = b[8]!;
	const b21 = b[9]!;
	const b22 = b[10]!;
	const b23 = b[11]!;

	const b30 = b[12]!;
	const b31 = b[13]!;
	const b32 = b[14]!;
	const b33 = b[15]!;

	out[0] = b00 * a00 + b01 * a10 + b02 * a20 + b03 * a30;
	out[1] = b00 * a01 + b01 * a11 + b02 * a21 + b03 * a31;
	out[2] = b00 * a02 + b01 * a12 + b02 * a22 + b03 * a32;
	out[3] = b00 * a03 + b01 * a13 + b02 * a23 + b03 * a33;

	out[4] = b10 * a00 + b11 * a10 + b12 * a20 + b13 * a30;
	out[5] = b10 * a01 + b11 * a11 + b12 * a21 + b13 * a31;
	out[6] = b10 * a02 + b11 * a12 + b12 * a22 + b13 * a32;
	out[7] = b10 * a03 + b11 * a13 + b12 * a23 + b13 * a33;

	out[8] = b20 * a00 + b21 * a10 + b22 * a20 + b23 * a30;
	out[9] = b20 * a01 + b21 * a11 + b22 * a21 + b23 * a31;
	out[10] = b20 * a02 + b21 * a12 + b22 * a22 + b23 * a32;
	out[11] = b20 * a03 + b21 * a13 + b22 * a23 + b23 * a33;

	out[12] = b30 * a00 + b31 * a10 + b32 * a20 + b33 * a30;
	out[13] = b30 * a01 + b31 * a11 + b32 * a21 + b33 * a31;
	out[14] = b30 * a02 + b31 * a12 + b32 * a22 + b33 * a32;
	out[15] = b30 * a03 + b31 * a13 + b32 * a23 + b33 * a33;

	return out;
}

// Multiply 4x4 matrix by 4x1 column-vector
export function glMat4MultiplyMatrixAndVector(
	out: Float32Array,
	a: Readonly<Float32Array>,
	vec: Readonly<Float32Array>,
) {
	const a00 = a[0]!;
	const a01 = a[1]!;
	const a02 = a[2]!;
	const a03 = a[3]!;

	const a10 = a[4]!;
	const a11 = a[5]!;
	const a12 = a[6]!;
	const a13 = a[7]!;

	const a20 = a[8]!;
	const a21 = a[9]!;
	const a22 = a[10]!;
	const a23 = a[11]!;

	const a30 = a[12]!;
	const a31 = a[13]!;
	const a32 = a[14]!;
	const a33 = a[15]!;

	const b0 = vec[0]!;
	const b1 = vec[1]!;
	const b2 = vec[2]!;
	const b3 = vec[3]!;

	out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
	out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
	out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
	out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

	return out;
}

// Invert 4x4 matrix
export function glMat4Invert(out: Float32Array, a: Readonly<Float32Array>) {
	const a00 = a[0]!;
	const a01 = a[1]!;
	const a02 = a[2]!;
	const a03 = a[3]!;
	const a10 = a[4]!;
	const a11 = a[5]!;
	const a12 = a[6]!;
	const a13 = a[7]!;
	const a20 = a[8]!;
	const a21 = a[9]!;
	const a22 = a[10]!;
	const a23 = a[11]!;
	const a30 = a[12]!;
	const a31 = a[13]!;
	const a32 = a[14]!;
	const a33 = a[15]!;

	const b00 = a00 * a11 - a01 * a10;
	const b01 = a00 * a12 - a02 * a10;
	const b02 = a00 * a13 - a03 * a10;
	const b03 = a01 * a12 - a02 * a11;
	const b04 = a01 * a13 - a03 * a11;
	const b05 = a02 * a13 - a03 * a12;
	const b06 = a20 * a31 - a21 * a30;
	const b07 = a20 * a32 - a22 * a30;
	const b08 = a20 * a33 - a23 * a30;
	const b09 = a21 * a32 - a22 * a31;
	const b10 = a21 * a33 - a23 * a31;
	const b11 = a22 * a33 - a23 * a32;

	// Calculate the determinant
	let det =
		b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

	if (!det) {
		return null;
	}

	det = 1 / det;

	out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
	out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
	out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
	out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
	out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
	out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
	out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
	out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
	out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
	out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
	out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
	out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
	out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
	out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
	out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
	out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;

	return out;
}

export function isPointWithinNormalizedDeviceCoordinates(
	point: [number, number, number],
) {
	return (
		Math.abs(point[0]) <= 1 &&
		Math.abs(point[1]) <= 1 &&
		Math.abs(point[2]) <= 1
	);
}

export function multiplyMatrices(
	a: readonly (readonly number[])[],
	b: readonly (readonly number[])[],
) {
	if (a.length === 0 || b.length === 0) {
		throw new Error("Cannot multiply by an empty matrix.");
	}

	const rowsA = a.length;
	const colsA = a[0]!.length;
	const rowsB = b.length;
	const colsB = b[0]!.length;

	if (colsA !== rowsB) {
		throw new Error(
			"Number of columns in the first matrix must equal the number of rows in the second matrix.",
		);
	}

	const result = Array.from({ length: rowsA }, () =>
		Array.from({ length: colsB }).fill(0),
	) as number[][];

	for (let index1 = 0; index1 < rowsA; index1++) {
		for (let index2 = 0; index2 < colsB; index2++) {
			for (let index3 = 0; index3 < colsA; index3++) {
				result[index1]![index2] =
					result[index1]![index2]! + a[index1]![index3]! * b[index3]![index2]!;
			}
		}
	}

	return result;
}

export function roundToPowerOfTwo(n: number): number {
	if (n <= 0) {
		return 0;
	}
	let power = 1;
	while (power < n) {
		power *= 2;
	}
	return power;
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

const DEFAULT_EQUALITY_TOLERANCE = 1e-10;

export class Vector2D {
	static readonly ZERO: Vector2D = new Vector2D(0, 0);
	static readonly ONE: Vector2D = new Vector2D(1, 1);
	static readonly NORTH: Vector2D = new Vector2D(0, 1);
	static readonly NORTH_WEST: Vector2D = new Vector2D(-1, 1);
	static readonly NORTH_EAST: Vector2D = new Vector2D(1, 1);
	static readonly SOUTH: Vector2D = new Vector2D(0, -1);
	static readonly SOUTH_WEST: Vector2D = new Vector2D(-1, -1);
	static readonly SOUTH_EAST: Vector2D = new Vector2D(1, -1);
	static readonly WEST: Vector2D = new Vector2D(-1, 0);
	static readonly EAST: Vector2D = new Vector2D(1, 0);

	x: number;
	y: number;

	constructor(x: number, y: number) {
		this.x = x;
		this.y = y;
	}

	static fromPoint2D({ x, y }: { readonly x: number; readonly y: number }) {
		return new Vector2D(x, y);
	}

	static fromArray(components: [number, number]) {
		const [x, y] = components;

		return new Vector2D(x, y);
	}

	toArray(): [number, number] {
		return [this.x, this.y];
	}

	add(vector: Vector2D): Vector2D {
		return new Vector2D(this.x + vector.x, this.y + vector.y);
	}

	subtract(vector: Vector2D): Vector2D {
		return new Vector2D(this.x - vector.x, this.y - vector.y);
	}

	scaleScalar(scalar: number): Vector2D {
		return new Vector2D(this.x * scalar, this.y * scalar);
	}

	scale(vector: Vector2D): Vector2D {
		return new Vector2D(this.x * vector.x, this.y * vector.y);
	}

	negate(): Vector2D {
		return new Vector2D(-this.x, -this.y);
	}

	length(): number {
		return Math.hypot(this.x, this.y);
	}

	lengthSquared(): number {
		const { x, y } = this;

		return x * x + y * y;
	}

	equals(
		vector: Vector2D,
		tolerance: number = DEFAULT_EQUALITY_TOLERANCE,
	): boolean {
		return (
			Math.abs(this.x - vector.x) < tolerance &&
			Math.abs(this.y - vector.y) < tolerance
		);
	}

	isZeroStrict(): boolean {
		return this.x === 0 && this.y === 0;
	}

	isZero(tolerance: number = DEFAULT_EQUALITY_TOLERANCE): boolean {
		return this.x < tolerance && this.y < tolerance;
	}

	isUnit(tolerance: number = DEFAULT_EQUALITY_TOLERANCE): boolean {
		return Math.abs(this.length() - 1) < tolerance;
	}

	copy(): Vector2D {
		return new Vector2D(this.x, this.y);
	}

	normalize(): Vector2D {
		const length = this.length();

		if (length === 0) {
			throw new Error("Cannot normalize a zero vector");
		}

		return this.scaleScalar(1 / length);
	}

	dot(vector: Vector2D): number {
		return this.x * vector.x + this.y * vector.y;
	}

	cross(vector: Vector2D): number {
		return this.x * vector.y - this.y * vector.x;
	}

	angleBetween(vector: Vector2D): number {
		const dotProduct = this.dot(vector);
		const lengths = this.length() * vector.length();

		if (lengths === 0) {
			throw new Error("Cannot calculate angle with a zero vector");
		}

		return Math.acos(dotProduct / lengths);
	}

	getPolarAngle(): number {
		return Math.atan2(this.y, this.x);
	}

	toPolar(): { radius: number; angle: number } {
		const radius = this.length();
		const angle = this.getPolarAngle();

		return { radius, angle };
	}

	static fromPolarAngle(angle: number): Vector2D {
		return new Vector2D(Math.cos(angle), Math.sin(angle));
	}

	static fromPolar({
		radius,
		angle,
	}: {
		readonly radius: number;
		readonly angle: number;
	}) {
		return Vector2D.fromPolarAngle(angle).scaleScalar(radius);
	}

	distanceTo(vector: Vector2D): number {
		const diff = this.subtract(vector);

		return diff.length();
	}

	lerp(vector: Vector2D, t: number): Vector2D {
		const x = this.x + (vector.x - this.x) * t;
		const y = this.y + (vector.y - this.y) * t;

		return new Vector2D(x, y);
	}

	rotate(angle: number): Vector2D {
		const cos = Math.cos(angle);
		const sin = Math.sin(angle);

		const xRotated = this.x * cos - this.y * sin;
		const yRotated = this.x * sin + this.y * cos;

		return new Vector2D(xRotated, yRotated);
	}

	rotateAround(point: Vector2D, angle: number): Vector2D {
		return this.subtract(point).rotate(angle).add(point);
	}

	clampLength(maxLength: number): Vector2D {
		const length = this.length();

		return length > maxLength
			? this.scaleScalar(maxLength / length)
			: this.copy();
	}

	project(onto: Vector2D): Vector2D {
		return onto.scaleScalar(this.dot(onto) / onto.dot(onto));
	}

	reflect(normal: Vector2D): Vector2D {
		return this.subtract(normal.scaleScalar(2 * this.dot(normal)));
	}

	normal(): Vector2D {
		return new Vector2D(-this.y, this.x);
	}

	scaleTo(length: number): Vector2D {
		const currentLength = this.length();

		if (currentLength === 0) {
			throw new Error("Cannot scale a zero vector");
		}

		return this.scaleScalar(length / currentLength);
	}

	insideRadius(radius: number): boolean {
		return this.length() <= radius;
	}

	abs(): Vector2D {
		const x = Math.abs(this.x);
		const y = Math.abs(this.y);

		return new Vector2D(x, y);
	}

	sign(): Vector2D {
		const x = Math.sign(this.x);
		const y = Math.sign(this.y);

		return new Vector2D(x, y);
	}

	minComponent(): number {
		return Math.min(this.x, this.y);
	}

	maxComponent(): number {
		return Math.max(this.x, this.y);
	}

	aspect(): number {
		return this.x / this.y;
	}

	trunc(): Vector2D {
		const x = Math.trunc(this.x);
		const y = Math.trunc(this.y);

		return new Vector2D(x, y);
	}

	floor(): Vector2D {
		const x = Math.floor(this.x);
		const y = Math.floor(this.y);

		return new Vector2D(x, y);
	}

	round(): Vector2D {
		const x = Math.round(this.x);
		const y = Math.round(this.y);

		return new Vector2D(x, y);
	}

	ceil(): Vector2D {
		const x = Math.ceil(this.x);
		const y = Math.ceil(this.y);

		return new Vector2D(x, y);
	}

	snappedRound(by: Vector2D): Vector2D {
		const x = Math.round(this.x / by.x) * by.x;
		const y = Math.round(this.y / by.y) * by.y;

		return new Vector2D(x, y);
	}

	snappedFloor(by: Vector2D): Vector2D {
		const x = Math.floor(this.x / by.x) * by.x;
		const y = Math.floor(this.y / by.y) * by.y;

		return new Vector2D(x, y);
	}

	snappedCeil(by: Vector2D): Vector2D {
		const x = Math.ceil(this.x / by.x) * by.x;
		const y = Math.ceil(this.y / by.y) * by.y;

		return new Vector2D(x, y);
	}

	static getIntersection(
		v1Start: Vector2D,
		v1End: Vector2D,
		v2Start: Vector2D,
		v2End: Vector2D,
	): Vector2D | null {
		const { x: x1, y: y1 } = v1Start;
		const { x: x2, y: y2 } = v1End;
		const { x: x3, y: y3 } = v2Start;
		const { x: x4, y: y4 } = v2End;

		// Calculate the determinants
		const denominator = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);

		// If the lines are parallel, no intersection
		if (denominator === 0) {
			return null;
		}

		// Calculate the intersection point by parameters t and u
		const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / denominator;
		const u = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / denominator;
		const pointOutsideLineSegments = t < 0 || t > 1 || u < 0 || u > 1;

		return pointOutsideLineSegments ? null : v1Start.lerp(v1End, t);
	}

	static randomDirection(): Vector2D {
		const x = Math.random() * 2 - 1;
		const y = Math.random() * 2 - 1;

		return new Vector2D(x, y).normalize();
	}

	toString(): string {
		return `Vector2D(${this.x}, ${this.y})`;
	}
}

export class Vector3D {
	static readonly ZERO: Vector3D = new Vector3D(0, 0, 0);
	static readonly ONE: Vector3D = new Vector3D(1, 1, 1);
	static readonly NORTH: Vector3D = new Vector3D(0, 1, 0);
	static readonly NORTH_WEST: Vector3D = new Vector3D(-1, 1, 0);
	static readonly NORTH_EAST: Vector3D = new Vector3D(1, 1, 0);
	static readonly SOUTH: Vector3D = new Vector3D(0, -1, 0);
	static readonly SOUTH_WEST: Vector3D = new Vector3D(-1, -1, 0);
	static readonly SOUTH_EAST: Vector3D = new Vector3D(1, -1, 0);
	static readonly WEST: Vector3D = new Vector3D(-1, 0, 0);
	static readonly EAST: Vector3D = new Vector3D(1, 0, 0);
	static readonly UP: Vector3D = new Vector3D(0, 0, 1);
	static readonly DOWN: Vector3D = new Vector3D(0, 0, -1);

	x: number;
	y: number;
	z: number;

	constructor(x: number, y: number, z: number) {
		this.x = x;
		this.y = y;
		this.z = z;
	}

	static fromPoint3D({
		x,
		y,
		z,
	}: {
		readonly x: number;
		readonly y: number;
		readonly z: number;
	}) {
		return new Vector3D(x, y, z);
	}

	static fromArray(components: [number, number, number]) {
		const [x, y, z] = components;

		return new Vector3D(x, y, z);
	}

	toArray(): [number, number, number] {
		return [this.x, this.y, this.z];
	}

	add(vector: Vector3D): Vector3D {
		const x = this.x + vector.x;
		const y = this.y + vector.y;
		const z = this.z + vector.z;

		return new Vector3D(x, y, z);
	}

	subtract(vector: Vector3D): Vector3D {
		const x = this.x - vector.x;
		const y = this.y - vector.y;
		const z = this.z - vector.z;

		return new Vector3D(x, y, z);
	}

	scaleScalar(scalar: number): Vector3D {
		const x = this.x * scalar;
		const y = this.y * scalar;
		const z = this.z * scalar;

		return new Vector3D(x, y, z);
	}

	scale(vector: Vector3D): Vector3D {
		const x = this.x * vector.x;
		const y = this.y * vector.y;
		const z = this.z * vector.z;

		return new Vector3D(x, y, z);
	}

	negate(): Vector3D {
		return new Vector3D(-this.x, -this.y, -this.z);
	}

	length(): number {
		return Math.hypot(this.x, this.y, this.z);
	}

	lengthSquared(): number {
		const { x, y, z } = this;

		return x * x + y * y + z * z;
	}

	equals(
		vector: Vector3D,
		tolerance: number = DEFAULT_EQUALITY_TOLERANCE,
	): boolean {
		return (
			Math.abs(this.x - vector.x) < tolerance &&
			Math.abs(this.y - vector.y) < tolerance &&
			Math.abs(this.z - vector.z) < tolerance
		);
	}

	isZeroStrict(): boolean {
		return this.x === 0 && this.y === 0 && this.z === 0;
	}

	isZero(tolerance: number = DEFAULT_EQUALITY_TOLERANCE): boolean {
		return this.x < tolerance && this.y < tolerance && this.z < tolerance;
	}

	isUnit(tolerance: number = DEFAULT_EQUALITY_TOLERANCE): boolean {
		return Math.abs(this.length() - 1) < tolerance;
	}

	copy(): Vector3D {
		return new Vector3D(this.x, this.y, this.z);
	}

	normalize(): Vector3D {
		const length = this.length();

		if (length === 0) {
			throw new Error("Cannot normalize a zero vector");
		}

		return this.scaleScalar(1 / length);
	}

	dot(vector: Vector3D): number {
		return this.x * vector.x + this.y * vector.y + this.z * vector.z;
	}

	cross(vector: Vector3D): Vector3D {
		const crossX = this.y * vector.z - this.z * vector.y;
		const crossY = this.z * vector.x - this.x * vector.z;
		const crossZ = this.x * vector.y - this.y * vector.x;

		return new Vector3D(crossX, crossY, crossZ);
	}

	distanceTo(vector: Vector3D): number {
		const diff = this.subtract(vector);

		return diff.length();
	}

	lerp(vector: Vector3D, t: number): Vector3D {
		const x = this.x + (vector.x - this.x) * t;
		const y = this.y + (vector.y - this.y) * t;
		const z = this.z + (vector.z - this.z) * t;

		return new Vector3D(x, y, z);
	}

	rotate(angle: number, axis: "x" | "y" | "z"): Vector3D {
		const cos = Math.cos(angle);
		const sin = Math.sin(angle);

		const { x, y, z } = this;

		if (axis === "x") {
			return new Vector3D(x, y * cos - z * sin, y * sin + z * cos);
		}

		if (axis === "y") {
			return new Vector3D(x * cos + z * sin, y, -x * sin + z * cos);
		}

		return new Vector3D(x * cos - y * sin, x * sin + y * cos, z);
	}

	clampLength(maxLength: number): Vector3D {
		const length = this.length();

		return length > maxLength
			? this.scaleScalar(maxLength / length)
			: this.copy();
	}

	project(onto: Vector3D): Vector3D {
		return onto.scaleScalar(this.dot(onto) / onto.dot(onto));
	}

	reflect(normal: Vector3D): Vector3D {
		return this.subtract(normal.scaleScalar(2 * this.dot(normal)));
	}

	normal(a: Vector3D, b: Vector3D): Vector3D {
		return a.subtract(this).cross(b.subtract(this));
	}

	scaleTo(length: number): Vector3D {
		const currentLength = this.length();

		if (currentLength === 0) {
			throw new Error("Cannot scale a zero vector");
		}

		return this.scaleScalar(length / currentLength);
	}

	insideRadius(radius: number): boolean {
		return this.length() <= radius;
	}

	abs(): Vector3D {
		const x = Math.abs(this.x);
		const y = Math.abs(this.y);
		const z = Math.abs(this.z);

		return new Vector3D(x, y, z);
	}

	sign(): Vector3D {
		const x = Math.sign(this.x);
		const y = Math.sign(this.y);
		const z = Math.sign(this.z);

		return new Vector3D(x, y, z);
	}

	minComponent(): number {
		return Math.min(this.x, this.y, this.z);
	}

	maxComponent(): number {
		return Math.max(this.x, this.y, this.z);
	}

	trunc(): Vector3D {
		const x = Math.trunc(this.x);
		const y = Math.trunc(this.y);
		const z = Math.trunc(this.z);

		return new Vector3D(x, y, z);
	}

	floor(): Vector3D {
		const x = Math.floor(this.x);
		const y = Math.floor(this.y);
		const z = Math.floor(this.z);

		return new Vector3D(x, y, z);
	}

	round(): Vector3D {
		const x = Math.round(this.x);
		const y = Math.round(this.y);
		const z = Math.round(this.z);

		return new Vector3D(x, y, z);
	}

	ceil(): Vector3D {
		const x = Math.ceil(this.x);
		const y = Math.ceil(this.y);
		const z = Math.ceil(this.z);

		return new Vector3D(x, y, z);
	}

	snappedRound(by: Vector3D): Vector3D {
		const x = Math.round(this.x / by.x) * by.x;
		const y = Math.round(this.y / by.y) * by.y;
		const z = Math.round(this.z / by.z) * by.z;

		return new Vector3D(x, y, z);
	}

	snappedFloor(by: Vector3D): Vector3D {
		const x = Math.floor(this.x / by.x) * by.x;
		const y = Math.floor(this.y / by.y) * by.y;
		const z = Math.floor(this.z / by.z) * by.z;

		return new Vector3D(x, y, z);
	}

	snappedCeil(by: Vector3D): Vector3D {
		const x = Math.ceil(this.x / by.x) * by.x;
		const y = Math.ceil(this.y / by.y) * by.y;
		const z = Math.ceil(this.z / by.z) * by.z;

		return new Vector3D(x, y, z);
	}

	static getIntersection(
		v1Start: Vector3D,
		v1End: Vector3D,
		v2Start: Vector3D,
		v2End: Vector3D,
	): Vector3D | null {
		const { x: x1, y: y1, z: z1 } = v1Start;
		const { x: x2, y: y2, z: z2 } = v1End;
		const { x: x3, y: y3, z: z3 } = v2Start;
		const { x: x4, y: y4, z: z4 } = v2End;

		// Calculate the direction vectors
		const d1 = new Vector3D(x2 - x1, y2 - y1, z2 - z1);
		const d2 = new Vector3D(x4 - x3, y4 - y3, z4 - z3);

		// Calculate the determinants
		const denominator = d1.x * d2.y - d1.y * d2.x;

		// If the lines are parallel, no intersection
		if (denominator === 0) {
			return null;
		}

		// Calculate the intersection point by parameters t and u
		const t = ((x3 - x1) * d2.y - (y3 - y1) * d2.x) / denominator;
		const u = ((x3 - x1) * d1.y - (y3 - y1) * d1.x) / denominator;
		const pointOutsideLineSegments = t < 0 || t > 1 || u < 0 || u > 1;

		return pointOutsideLineSegments ? null : v1Start.lerp(v1End, t);
	}

	static randomDirection(): Vector3D {
		const x = Math.random() * 2 - 1;
		const y = Math.random() * 2 - 1;
		const z = Math.random() * 2 - 1;

		return new Vector3D(x, y, z).normalize();
	}

	toString(): string {
		return `Vector3D(${this.x}, ${this.y}, ${this.z})`;
	}
}
