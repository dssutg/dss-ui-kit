import type { Config } from 'tailwindcss';

/**
 * The Tailwind preset, published as `dss-ui-kit/tailwind`.
 *
 * A consuming application cannot discover the token map by reading this package's config: it has to
 * reproduce it, and a copied map drifts from the library without anything noticing. The map is
 * therefore exported here and this repository's own `tailwind.config.ts` consumes it, so there is one
 * copy of it and a token that is renamed or removed is a type error in a consumer's config rather than
 * a class that silently stops resolving.
 *
 * ```ts
 * // tailwind.config.ts in the consuming application
 * import { uiKitPreset } from 'dss-ui-kit/tailwind';
 *
 * export default {
 *   presets: [uiKitPreset],
 * };
 * ```
 *
 * What this preset deliberately does not carry is `content`. Tailwind resolves a `content` path
 * against the working directory of the build that reads the config, so a path written here would be
 * resolved against this repository when the package is built and against whatever the consumer's
 * script happens to be in when it is not. Scanning the published bundle is the consumer's line to
 * write, and forgetting it is the one mistake that leaves a component unstyled, so it is stated
 * where the consumer will look for it instead: in the README, which carries the whole config.
 */

/**
 * The colour map: every `--color-*` custom property the theme files define, as the Tailwind colour
 * utility of the same name.
 *
 * Exported on its own, not only inside the preset, so a consumer building a token picker or a theme
 * editor can enumerate the tokens instead of hard-coding the list a second time. The key and the
 * value are written on the same line, which is what keeps the class name and the custom property from
 * drifting apart.
 */
export const colorTokens = {
  bbp: 'var(--color-bbp)',
  bda: 'var(--color-bda)',
  bdat: 'var(--color-bdat)',
  bexpander: 'var(--color-bexpander)',
  bgt: 'var(--color-bgt)',
  bhd: 'var(--color-bhd)',
  bin: 'var(--color-bin)',
  black: 'var(--color-black)',
  'blue-light': 'var(--color-blue-light)',
  bno: 'var(--color-bno)',
  bnot: 'var(--color-bnot)',
  bocb: 'var(--color-bocb)',
  bok: 'var(--color-bok)',
  bokt: 'var(--color-bokt)',
  bopl: 'var(--color-bopl)',
  bpd: 'var(--color-bpd)',
  bpd2: 'var(--color-bpd2)',
  bpl: 'var(--color-bpl)',
  brand: 'var(--color-brand)',
  'brown-light': 'var(--color-brown-light)',
  'brown-light2': 'var(--color-brown-light2)',
  bse: 'var(--color-bse)',
  bslider: 'var(--color-bslider)',
  bsp: 'var(--color-bsp)',
  'button-good-bg': 'var(--color-button-good-bg)',
  'button-good-fg': 'var(--color-button-good-fg)',
  'button-good-mobile-bg': 'var(--color-button-good-mobile-bg)',
  'button-good-mobile-fg': 'var(--color-button-good-mobile-fg)',
  'button-regular-bg': 'var(--color-button-regular-bg)',
  'cyan-light': 'var(--color-cyan-light)',
  'cyan-light2': 'var(--color-cyan-light2)',
  'error-dialog-window-bg': 'var(--color-error-dialog-window-bg)',
  'error-dialog-window-close-button-bg': 'var(--color-error-dialog-window-close-button-bg)',
  'error-dialog-window-close-button-text': 'var(--color-error-dialog-window-close-button-text)',
  'error-dialog-window-scroll-bar': 'var(--color-error-dialog-window-scroll-bar)',
  'error-dialog-window-scroll-bar-thumb': 'var(--color-error-dialog-window-scroll-bar-thumb)',
  'error-dialog-window-text': 'var(--color-error-dialog-window-text)',
  'gray-light': 'var(--color-gray-light)',
  'gray-light2': 'var(--color-gray-light2)',
  'gray-light3': 'var(--color-gray-light3)',
  'gray-light4': 'var(--color-gray-light4)',
  'gray-light5': 'var(--color-gray-light5)',
  'gray-light6': 'var(--color-gray-light6)',
  'gray-light7': 'var(--color-gray-light7)',
  'gray-light8': 'var(--color-gray-light8)',
  'green-light': 'var(--color-green-light)',
  'icon-inactive': 'var(--color-icon-inactive)',
  'icon-regular': 'var(--color-icon-regular)',
  'inactive-text': 'var(--color-inactive-text)',
  'indigo-dark': 'var(--color-indigo-dark)',
  'indigo-dark2': 'var(--color-indigo-dark2)',
  'indigo-light': 'var(--color-indigo-light)',
  'input-bg': 'var(--color-input-bg)',
  'loading-spinner-bg': 'var(--color-loading-spinner-bg)',
  'loading-spinner-fg': 'var(--color-loading-spinner-fg)',
  'magenta-dark': 'var(--color-magenta-dark)',
  'menu-item': 'var(--color-menu-item)',
  'mini-calendar-adjacent': 'var(--color-mini-calendar-adjacent)',
  'mini-calendar-bg': 'var(--color-mini-calendar-bg)',
  'mini-calendar-title-fg': 'var(--color-mini-calendar-title-fg)',
  'mini-calendar-today-bg': 'var(--color-mini-calendar-today-bg)',
  'mini-calendar-today-fg': 'var(--color-mini-calendar-today-fg)',
  'mini-calendar-weekday': 'var(--color-mini-calendar-weekday)',
  'mini-calendar-weekend': 'var(--color-mini-calendar-weekend)',
  'notification-panel-bg': 'var(--color-notification-panel-bg)',
  'notification-panel-item-unread-bg': 'var(--color-notification-panel-item-unread-bg)',
  'notification-panel-relative-date': 'var(--color-notification-panel-relative-date)',
  ocaxis: 'var(--color-ocaxis)',
  occlp: 'var(--color-occlp)',
  occls: 'var(--color-occls)',
  ochi: 'var(--color-ochi)',
  'ochi-selected': 'var(--color-ochi-selected)',
  ocpl: 'var(--color-ocpl)',
  'pink-light': 'var(--color-pink-light)',
  placeholder: 'var(--color-placeholder)',
  'purple-light': 'var(--color-purple-light)',
  'purple-light2': 'var(--color-purple-light2)',
  'red-light': 'var(--color-red-light)',
  'ring-progress-bar-bad': 'var(--color-ring-progress-bar-bad)',
  'ring-progress-bar-good': 'var(--color-ring-progress-bar-good)',
  'ring-progress-bar-normal': 'var(--color-ring-progress-bar-normal)',
  'ripple-button': 'var(--color-ripple-button)',
  'ripple-icon-button': 'var(--color-ripple-icon-button)',
  'scroll-progress-bar': 'var(--color-scroll-progress-bar)',
  separator: 'var(--color-separator)',
  sliderthumb: 'var(--color-sliderthumb)',
  tbp: 'var(--color-tbp)',
  tda: 'var(--color-tda)',
  texpander: 'var(--color-texpander)',
  text: 'var(--color-text)',
  tgt: 'var(--color-tgt)',
  thd: 'var(--color-thd)',
  ths: 'var(--color-ths)',
  tin: 'var(--color-tin)',
  tli: 'var(--color-tli)',
  tno: 'var(--color-tno)',
  'to-top-bg': 'var(--color-to-top-bg)',
  tok: 'var(--color-tok)',
  topd: 'var(--color-topd)',
  topl: 'var(--color-topl)',
  tpd: 'var(--color-tpd)',
  tpl: 'var(--color-tpl)',
  tse: 'var(--color-tse)',
  tsp: 'var(--color-tsp)',
  white: 'var(--color-white)',
  'yellow-light': 'var(--color-yellow-light)',
} as const satisfies Record<string, string>;

/**
 * The name of one design token, which is also the name of its Tailwind colour utility.
 *
 * The union is derived rather than written out, so a token that is renamed is a type error
 * everywhere a consumer names one.
 */
export type ColorToken = keyof typeof colorTokens;

/**
 * The font families the components are written against.
 *
 * The first entry is what the components ask for and the rest are the fallbacks behind it, so a
 * consumer gets the same rendering whether or not the first family is installed.
 */
export const fontFamilies = {
  sans: ['Inter', 'Segoe UI', 'Roboto', 'system-ui', 'sans-serif'],
  mono: ['JetBrains Mono', 'Cascadia Mono', 'Consolas', 'monospace'],
} satisfies Record<string, string[]>;

/**
 * The preset itself, for a consuming application's `tailwind.config.ts`.
 *
 * It extends rather than replaces `theme`, so a consumer's own colours, spacing and breakpoints
 * survive alongside the tokens, and it declares no `darkMode`: no component in this library uses the
 * `dark:` variant, because a theme is data rather than a build artefact and the variables resolve at
 * runtime from a `data-theme` attribute on `<body>`.
 *
 * Everything here is inside `theme.extend`, which is the only part a preset may contribute without
 * removing what the consumer configured.
 *
 * The type is `Partial<Config>` because that is what Tailwind types a preset as, and `Config` itself
 * requires `content`: a preset has no business declaring what a consuming application scans.
 */
export const uiKitPreset = {
  theme: {
    extend: {
      colors: colorTokens,
      fontFamily: fontFamilies,
      /**
       * The animations the components render, and the keyframes they run.
       *
       * `animate-*` is a Tailwind utility like any other: a consumer's stylesheet generates it only if
       * the config names it, so a component rendering `animate-wsh-spinner-rotator` renders a class
       * that resolves to nothing in every application that did not write this keyframe itself. The
       * declaration is what makes the class exist, and it is why this belongs beside the colour map
       * rather than in a stylesheet the consumer has to remember to import.
       *
       * A key is the class name without the `animate-` prefix and its value names the keyframe of the
       * same key, so the class and what it runs are one fact.
       *
       * The animations no component renders live as hand-written rules in `src/css/animations.css`;
       * one of them sets a `transform-origin` beside its animation, which an `animation` value has no
       * way to carry.
       *
       * The ripple is the one animation whose duration is not a literal: it reads `--ripple-duration`,
       * which every ripple sets on itself from its `duration` prop, so the circle is removed at
       * `duration - 100` — a little before it finishes — for every duration rather than only for the
       * 600ms default.
       */
      animation: {
        'fade-in': 'fade-in 0.5s',
        ripple: 'ripple linear var(--ripple-duration, 600ms)',
        'wsh-spinner-container': 'wsh-spinner-container 1.56823529647s linear infinite',
        'wsh-spinner-left': 'wsh-spinner-left 1333ms cubic-bezier(0.4, 0, 0.2, 1) infinite both',
        'wsh-spinner-right': 'wsh-spinner-right 1333ms cubic-bezier(0.4, 0, 0.2, 1) infinite both',
        'wsh-spinner-rotator':
          'wsh-spinner-rotator 5332ms cubic-bezier(0.4, 0, 0.2, 1) infinite both',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          to: { opacity: '1' },
        },
        ripple: {
          '0%': { transform: 'scale(0)', opacity: '1' },
          to: { transform: 'scale(4)', opacity: '0' },
        },
        'wsh-spinner-container': {
          to: { transform: 'rotate(360deg)' },
        },
        'wsh-spinner-left': {
          '0%': { transform: 'rotate(130deg)' },
          '50%': { transform: 'rotate(-5deg)' },
          to: { transform: 'rotate(130deg)' },
        },
        'wsh-spinner-right': {
          '0%': { transform: 'rotate(-130deg)' },
          '50%': { transform: 'rotate(5deg)' },
          to: { transform: 'rotate(-130deg)' },
        },
        'wsh-spinner-rotator': {
          '12.5%': { transform: 'rotate(135deg)' },
          '25%': { transform: 'rotate(270deg)' },
          '37.5%': { transform: 'rotate(405deg)' },
          '50%': { transform: 'rotate(540deg)' },
          '62.5%': { transform: 'rotate(675deg)' },
          '75%': { transform: 'rotate(810deg)' },
          '87.5%': { transform: 'rotate(945deg)' },
          to: { transform: 'rotate(1080deg)' },
        },
      },
    },
  },
} satisfies Partial<Config>;
