import { cmp } from "@/lib/math";

export function fuzzySearch<T>(
	query: string,
	array: readonly T[],
	cleanString: (queryOrItemName: string) => string,
	getItemName: (item: T) => string,
): readonly T[] {
	const LOWEST_SCORE = -1;
	const HIGHEST_SCORE = Infinity;

	const cleanQuery = cleanString(query);

	if (cleanQuery === "") {
		return array;
	}

	const results: { item: T; score: number }[] = [];

	for (const item of array) {
		const itemName = cleanString(getItemName(item));

		let score = 0;

		if (itemName.includes(cleanQuery)) {
			// Give the highest score to the exact match
			score = HIGHEST_SCORE;
		} else {
			// Fuzzy match
			let matchIndex = 0;

			for (const char of cleanQuery) {
				matchIndex = itemName.indexOf(char, matchIndex);
				if (matchIndex === -1) {
					// If any character is not found, set the lowest score
					score = LOWEST_SCORE;
					break;
				}
				score = score + 1 - matchIndex / itemName.length;
				matchIndex = matchIndex + 1;
			}
		}

		if (score !== LOWEST_SCORE) {
			results.push({ item, score });
		}
	}

	// Sort results based on score (higher score means better match)
	// and return only items (not the scores).
	return results
		.sort((a, b) => -cmp(a.score, b.score))
		.map((result) => result.item);
}
