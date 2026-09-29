// The code is derived from a gist on the web, so the following rules are disabled
// to avoid breaking changes
const grad3 = new Float32Array([
	1, 1, 0, -1, 1, 0, 1, -1, 0,

	-1, -1, 0, 1, 0, 1, -1, 0, 1,

	1, 0, -1, -1, 0, -1, 0, 1, 1,

	0, -1, 1, 0, 1, -1, 0, -1, -1,
]);

export class Simplex {
	private perm: Uint8Array;
	private permMod12: Uint8Array;

	constructor() {
		function buildPermutationTable() {
			const p = new Uint8Array(256);

			for (let i = 0; i < 256; i++) {
				p[i] = i;
			}
			for (let i = 0; i < 255; i++) {
				const r = i + Math.trunc(Math.random() * (256 - i));

				[p[i], p[r]] = [p[r]!, p[i]!];
			}

			return p;
		}

		const p = buildPermutationTable();

		this.perm = new Uint8Array(512);
		this.permMod12 = new Uint8Array(512);

		for (let i = 0; i < 512; i++) {
			this.perm[i] = p[i & 255]!;
			this.permMod12[i] = this.perm[i]! % 12;
		}
	}

	noise(
		x = 0,
		y = 0,
		t = 0,
		{
			amplitude = 1, // [0..1] take all possible height values (1) or only part of it (< 1)
			distribution = 1, // [0..X] 0..1 - get values from top, 1..X get values from bottom
			scale = 1, // [0..1] 0 - max scale, 1 - min scale
			octaves = 1, // [1..X] map detalization
		} = {},
	) {
		function rawNoise(
			xin: number,
			yin: number,
			tin: number,
			permMod12: Uint8Array,
			perm: Uint8Array | number[],
			grad3: number[] | Float32Array,
		) {
			const F3 = 1.0 / 3.0;
			const G3 = 1.0 / 6.0;
			// Noise contributions from the four corners
			let n0 = 0;
			let n1 = 0;
			let n2 = 0;
			let n3 = 0;
			// Skew the input space to determine which simplex cell we're in
			const s = (xin + yin + tin) * F3; // Very nice and simple skew factor for 3D
			const i = Math.floor(xin + s);
			const j = Math.floor(yin + s);
			const k = Math.floor(tin + s);
			const t = (i + j + k) * G3;
			const X0 = i - t; // Un-skew the cell origin back to (x,y,z) space
			const Y0 = j - t;
			const Z0 = k - t;
			const x0 = xin - X0; // The x,y,z distances from the cell origin
			const y0 = yin - Y0;
			const z0 = tin - Z0;
			// For the 3D case, the simplex shape is a slightly irregular tetrahedron.
			// Determine which simplex we are in.
			// Offsets for second corner of simplex in (i,j,k) coords
			let i1 = 0;
			let j1 = 0;
			let k1 = 0;

			// Offsets for third corner of simplex in (i,j,k) coords
			let i2 = 0;
			let j2 = 0;
			let k2 = 0;

			if (x0 >= y0) {
				if (y0 >= z0) {
					i1 = 1;
					j1 = 0;
					k1 = 0;
					i2 = 1;
					j2 = 1;
					k2 = 0;
				} else if (x0 >= z0) {
					i1 = 1;
					j1 = 0;
					k1 = 0;
					i2 = 1;
					j2 = 0;
					k2 = 1;
				} else {
					i1 = 0;
					j1 = 0;
					k1 = 1;
					i2 = 1;
					j2 = 0;
					k2 = 1;
				}
			} else {
				if (y0 < z0) {
					i1 = 0;
					j1 = 0;
					k1 = 1;
					i2 = 0;
					j2 = 1;
					k2 = 1;
				} else if (x0 < z0) {
					i1 = 0;
					j1 = 1;
					k1 = 0;
					i2 = 0;
					j2 = 1;
					k2 = 1;
				} else {
					i1 = 0;
					j1 = 1;
					k1 = 0;
					i2 = 1;
					j2 = 1;
					k2 = 0;
				}
			}

			// A step of (1,0,0) in (i,j,k) means a step of (1-c,-c,-c) in (x,y,z),
			// a step of (0,1,0) in (i,j,k) means a step of (-c,1-c,-c) in (x,y,z), and
			// a step of (0,0,1) in (i,j,k) means a step of (-c,-c,1-c) in (x,y,z), where
			// c = 1/6.
			const x1 = x0 - i1 + G3; // Offsets for second corner in (x,y,z) coords
			const y1 = y0 - j1 + G3;
			const z1 = z0 - k1 + G3;
			const x2 = x0 - i2 + 2.0 * G3; // Offsets for third corner in (x,y,z) coords
			const y2 = y0 - j2 + 2.0 * G3;
			const z2 = z0 - k2 + 2.0 * G3;
			const x3 = x0 - 1.0 + 3.0 * G3; // Offsets for last corner in (x,y,z) coords
			const y3 = y0 - 1.0 + 3.0 * G3;
			const z3 = z0 - 1.0 + 3.0 * G3;
			// Work out the hashed gradient indices of the four simplex corners
			const ii = i & 255;
			const jj = j & 255;
			const kk = k & 255;
			// Calculate the contribution from the four corners
			let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;

			if (t0 < 0) {
				n0 = 0.0;
			} else {
				const gi0 = permMod12[ii + perm[jj + perm[kk]!]!]! * 3;

				t0 *= t0;
				n0 =
					t0 *
					t0 *
					(grad3[gi0]! * x0 + grad3[gi0 + 1]! * y0 + grad3[gi0 + 2]! * z0);
			}

			let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;

			if (t1 < 0) {
				n1 = 0.0;
			} else {
				const gi1 = permMod12[ii + i1 + perm[jj + j1 + perm[kk + k1]!]!]! * 3;

				t1 *= t1;
				n1 =
					t1 *
					t1 *
					(grad3[gi1]! * x1 + grad3[gi1 + 1]! * y1 + grad3[gi1 + 2]! * z1);
			}

			let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;

			if (t2 < 0) {
				n2 = 0.0;
			} else {
				const gi2 = permMod12[ii + i2 + perm[jj + j2 + perm[kk + k2]!]!]! * 3;

				t2 *= t2;
				n2 =
					t2 *
					t2 *
					(grad3[gi2]! * x2 + grad3[gi2 + 1]! * y2 + grad3[gi2 + 2]! * z2);
			}

			let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;

			if (t3 < 0) {
				n3 = 0.0;
			} else {
				const gi3 = permMod12[ii + 1 + perm[jj + 1 + perm[kk + 1]!]!]! * 3;

				t3 *= t3;
				n3 =
					t3 *
					t3 *
					(grad3[gi3]! * x3 + grad3[gi3 + 1]! * y3 + grad3[gi3 + 2]! * z3);
			}

			// Add contributions from each corner to get the final noise value.
			// The result is scaled to stay just inside [-1,1]
			return 32.0 * (n0 + n1 + n2 + n3);
		}

		let currentAmplitude = amplitude;
		let currentScale = scale;
		let noise = 0;

		for (let i = 0, l = octaves; i < l; i++) {
			noise +=
				rawNoise(
					x * currentScale,
					y * currentScale,
					t,
					this.permMod12,
					this.perm,
					grad3,
				) * currentAmplitude;
			currentAmplitude *= 0.5;
			currentScale *= 2;
		}

		return ((noise + 1) / 2) ** distribution;
	}
}
