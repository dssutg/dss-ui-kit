export function getPluralizationIndex(locale: "en" | "ru", count: number) {
	switch (locale) {
		case "en":
			return Number(count !== 1);

		case "ru":
			// 1 apple
			if (count % 10 === 1 && count % 100 !== 11) {
				return 0;
			}

			// 2 apples
			if (
				count % 10 >= 2 &&
				count % 10 <= 4 &&
				(count % 100 < 10 || count % 100 >= 20)
			) {
				return 1;
			}

			// 0 apples
			return 2;
	}
}
