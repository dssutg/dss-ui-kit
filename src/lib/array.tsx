import { cmp, wrapIndex } from "@/lib/math";

export function chunkArray<T>(array: readonly T[], chunkSize: number): T[][] {
	const step = Math.trunc(chunkSize);

	if (step <= 0) {
		return [];
	}

	let chunkList: T[][] = [];

	for (let i = 0; i < array.length; i += step) {
		chunkList = [...chunkList, array.slice(i, i + step)];
	}

	return chunkList;
}
// This function compares two arrays: a and b.
// Returns -1 if a < b, 1 if a > b, 0 if a == b.

export function compareArrays<T>(a: readonly T[], b: readonly T[]) {
	const minLength = Math.min(a.length, b.length);

	for (let i = 0; i < minLength; i++) {
		if (a[i]! < b[i]!) {
			return -1;
		}
		if (a[i]! > b[i]!) {
			return +1;
		}
	}

	if (a.length < b.length) {
		return -1;
	}
	if (a.length > b.length) {
		return +1;
	}

	return 0;
}

export function getStringArrayAsColumnLines(
	strings: readonly string[],
	columnCount: number,
) {
	const columnWidths = Array.from<number>({ length: columnCount }).fill(0);

	for (let i = 0; i < strings.length; i += columnCount) {
		const columns = strings.slice(i, i + columnCount);

		for (let j = 0; j < columnCount; j++) {
			columnWidths[j] = Math.max(columns[j]?.length ?? 0, columnWidths[j]!);
		}
	}

	let lines: string[] = [];

	for (let i = 0; i < strings.length; i += columnCount) {
		let line = "";
		const columns = strings.slice(i, i + columnCount);

		for (let j = 0; j < columnCount; j++) {
			const width = columnWidths[j]!;

			line = `${line}${(columns[j] ?? "").padEnd(width, " ")}  `;
		}
		lines = [...lines, `  ${line}`];
	}

	return lines;
}

export function groupArrayByProperty<T>(
	array: readonly T[],
	getPropertyValue: (item: T) => string | number,
) {
	const map: Record<string, T[]> = {};

	for (const item of array) {
		const value = getPropertyValue(item);

		if (map[value] === undefined) {
			map[value] = [];
		}

		map[value].push(item);
	}

	return map;
}

export function groupArrayByPropertyUnique<T>(
	array: readonly T[],
	getPropertyValue: (item: T) => string | number,
) {
	return Object.fromEntries(
		array.map((item) => [getPropertyValue(item), item]),
	);
}

export function isChildArrayPath<T>(
	childPath: readonly T[],
	parentPath: readonly T[],
): boolean {
	for (const [i, element] of childPath.entries()) {
		if (element !== parentPath[i]) {
			return false;
		}
	}

	return true;
}

export function maxInArray(array: readonly number[]): number {
	if (array.length === 0) {
		return -Infinity;
	}

	let max = array[0]!;

	for (const element of array) {
		if (element > max) {
			max = element;
		}
	}

	return max;
}

export function maxInArrayMapped<T>(
	array: readonly T[],
	elementMapper: (element: T, index: number) => number,
) {
	if (array.length === 0) {
		return null;
	}

	let max = elementMapper(array[0]!, 0);
	let maxElementIndex = 0;

	for (let i = 1; i < array.length; i++) {
		const element = array[i]!;
		const elementValue = elementMapper(element, i);

		if (elementValue > max) {
			max = elementValue;
			maxElementIndex = i;
		}
	}

	return { max, maxElement: array[maxElementIndex]!, maxElementIndex };
}

export function sumArray(array: readonly number[]) {
	let sum = 0;
	for (const element of array) {
		sum += element;
	}
	return sum;
}

export function averageArray(array: readonly number[]) {
	if (array.length === 0) {
		return 0;
	}
	return sumArray(array) / array.length;
}

export function medianInArray(array: readonly number[]) {
	if (array.length === 0) {
		throw new Error("Array cannot be empty.");
	}

	const sorted = array.toSorted(cmp);
	const middle = Math.floor(sorted.length / 2);

	return sorted.length % 2 === 0
		? (sorted[middle - 1]! + sorted[middle]!) / 2
		: sorted[middle]!;
}

export function minInArray(array: readonly number[]): number {
	if (array.length === 0) {
		return Infinity;
	}

	let min = array[0]!;

	for (const element of array) {
		if (element < min) {
			min = element;
		}
	}

	return min;
}

export function minInArrayMapped<T>(
	array: readonly T[],
	elementMapper: (element: T, index: number) => number,
) {
	if (array.length === 0) {
		return null;
	}

	let min = elementMapper(array[0]!, 0);
	let minElementIndex = 0;

	for (let i = 1; i < array.length; i++) {
		const element = array[i]!;
		const elementValue = elementMapper(element, i);

		if (elementValue < min) {
			min = elementValue;
			minElementIndex = i;
		}
	}

	return { min, minElement: array[minElementIndex]!, minElementIndex };
}

export function modeInArray(array: readonly number[]) {
	if (array.length === 0) {
		return [];
	}

	const frequencyMap: Record<number, number> = {};

	for (const element of array) {
		frequencyMap[element] = (frequencyMap[element] ?? 0) + 1;
	}

	const maxFrequency = maxInArray(Object.values(frequencyMap));

	const modes = Object.keys(frequencyMap)
		.filter((element) => frequencyMap[Number(element)] === maxFrequency)
		.map(Number);

	return modes;
}
// Return a new array with the element at the index moved by one position left or right.
// If the element to move left or right is outside of the array
// bounds it is wrapped around the length of the array, i.e.,
// if the first element is moved left (destination index: -1) it will
// be moved to the very end of the array. And if the last element
// is moved right (destination index: array length + 1) it will be
// moved to the very beginning of the array. This forms a circular
// movement.
//
// If the given index is out of bounds it is wrapped around the
// length of the array.

export function moveArrayElementLeftOrRightCircularly<T>(
	array: readonly T[] = [],
	index = 0,
	isLeft = true,
): T[] {
	if (array.length === 0) {
		return [];
	}

	const delta = isLeft ? -1 : 1;

	const oldIndex = wrapIndex(index, array.length);
	const newIndex = wrapIndex(oldIndex + delta, array.length);

	return moveArrayElement(array, oldIndex, newIndex);
}
// Return a new array with the element at the index moved from one position to another one.
// If the given indexes are out of bounds they are wrapped around the
// length of the array.

export function moveArrayElement<T>(
	array: readonly T[] = [],
	from = 0,
	to = 0,
): T[] {
	if (array.length === 0) {
		return [];
	}

	const wrappedFrom = wrapIndex(from, array.length);
	const wrappedTo = wrapIndex(to, array.length);

	const element = array[wrappedFrom]!;

	const newArray = [
		...array.slice(0, wrappedFrom),
		...array.slice(wrappedFrom + 1),
	];

	return [
		...newArray.slice(0, wrappedTo),
		element,
		...newArray.slice(wrappedTo),
	];
}

export function randomArrayElement<T>(array: readonly T[]) {
	return array[Math.floor(Math.random() * array.length)];
}

export function removeDuplicatesFromArray<T>(array: readonly T[]) {
	return [...new Set(array)];
}

export function removeDuplicateObjectsFromArray<T>(array: readonly T[]) {
	let uniqueObjects: T[] = [];
	const seenObjects = new Set();

	for (const object of array) {
		const objectString = JSON.stringify(object);

		if (!seenObjects.has(objectString)) {
			seenObjects.add(objectString);
			uniqueObjects = [...uniqueObjects, object];
		}
	}

	return uniqueObjects;
}

export function binarySearch<T>(
	array: readonly T[],
	target: T,
	compareFunction: (a: T, b: T) => number,
	{ returnInsertionIndex = false } = {},
): number {
	let left = 0;
	let right = array.length - 1;

	while (left <= right) {
		const middle = left + Math.floor((right - left) / 2);
		const comparison = compareFunction(array[middle]!, target);

		if (comparison === 0) {
			// Target found
			return middle;
		} else if (comparison < 0) {
			// Search in the right half
			left = middle + 1;
		} else {
			// Search in the left half
			right = middle - 1;
		}
	}

	return returnInsertionIndex ? left : -1;
}

export function shuffleArray<T>(array: T[]) {
	for (let i = array.length - 1; i > 0; i--) {
		const other = Math.floor(Math.random() * (i + 1));

		const tmp = array[i]!;

		array[i] = array[other]!;
		array[other] = tmp;
	}

	return array;
}
