import forms from '@tailwindcss/forms';
import type { Config } from 'tailwindcss';
import { uiKitPreset } from './src/tailwind_preset.ts';

/**
 * This repository's Tailwind config.
 *
 * It is the same shape a consuming application writes, and it consumes the published preset rather
 * than restating the token map: `dss-ui-kit/tailwind` is built from `src/tailwind_preset.ts`, which is
 * where the 106 `--color-*` custom properties are mapped onto Tailwind colour utilities. A consumer
 * that installs the package and puts the preset in `presets` therefore runs the identical lookup this
 * build does, and a token added to one of the two without the other is a test failure rather than a
 * class that resolves here and nowhere else.
 *
 * The token names are part of the package's contract. A consumer that renders `bg-bda` needs
 * `--color-bda` to be defined, so the theme files and the preset ship together and neither is
 * optional. Adding a token is not a breaking change; renaming one is.
 *
 * There is no `darkMode` setting, and that is deliberate: no component in this library uses the
 * `dark:` variant. A theme is data rather than a build artefact — the variables resolve at runtime
 * from a `data-theme` attribute on `<body>`, so switching theme recompiles nothing.
 */
export default {
  presets: [uiKitPreset],
  content: [
    './src/**/*.{ts,tsx}',
    // Both this repository's source and the bundle are scanned, and the bundle is what a consumer
    // gets. Tailwind only sees a class name if it appears literally in a file it scans, so the
    // built package has to be scanned for the classes to reach a consumer's stylesheet: scanning
    // only `src/` would work here and generate nothing for anyone who installs the package.
    //
    // This is why no component builds a class name by concatenating pieces of one. Every class is
    // written out whole somewhere in the source, which is what keeps the scanner honest.
    './dist/**/*.{js,cjs}',
  ],
  plugins: [forms],
} satisfies Config;
