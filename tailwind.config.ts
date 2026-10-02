import forms from '@tailwindcss/forms';
import type { Config } from 'tailwindcss';

/**
 * The design tokens.
 *
 * Every one of the 119 `--color-*` custom properties the theme files define is exposed here as a
 * Tailwind colour, which is how the components reference them — `bg-bda`, `text-tpl`, `border-tpl`,
 * `placeholder-tpd`, `fill-tok`. The name and the custom property are written on the same line, so
 * the class name and the variable cannot drift apart.
 *
 * The class names are part of the package's contract. A consumer that renders `bg-bda` needs
 * `--color-bda` to be defined, so the theme files and this config ship together and neither is
 * optional. Adding a token is not a breaking change; renaming one is.
 *
 * `theme_dark.css` is the only theme that defines all 119. The other four are partial overrides
 * applied to `body[data-theme="..."]`, and they inherit the rest.
 *
 * The tokens are generated from `src/css/theme_*.css`, not maintained by hand. To add one, add it
 * to the theme files and regenerate.
 *
 * There is no `darkMode` setting, and that is deliberate: no component in this library uses the
 * `dark:` variant. A theme is data rather than a build artefact — the variables resolve at runtime
 * from a `data-theme` attribute on `<body>`, so switching theme recompiles nothing.
 */
export default {
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
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'Roboto', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Cascadia Mono', 'Consolas', 'monospace'],
      },
      colors: {
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
        'error-dialog-window-close-button-text':
          'var(--color-error-dialog-window-close-button-text)',
        'error-dialog-window-scroll-bar': 'var(--color-error-dialog-window-scroll-bar)',
        'error-dialog-window-scroll-bar-thumb': 'var(--color-error-dialog-window-scroll-bar-thumb)',
        'error-dialog-window-text': 'var(--color-error-dialog-window-text)',
        'event-log-record-cell-border': 'var(--color-event-log-record-cell-border)',
        'event-log-record-column-bg': 'var(--color-event-log-record-column-bg)',
        'event-log-record-column-fg': 'var(--color-event-log-record-column-fg)',
        'event-log-record-header-column-bg': 'var(--color-event-log-record-header-column-bg)',
        'event-log-record-header-column-fg': 'var(--color-event-log-record-header-column-fg)',
        'event-log-window-bg': 'var(--color-event-log-window-bg)',
        'graph-connected-edge': 'var(--color-graph-connected-edge)',
        'graph-disconnected-edge': 'var(--color-graph-disconnected-edge)',
        'graph-edge-selected': 'var(--color-graph-edge-selected)',
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
        'zone-manager-main-window-bg': 'var(--color-zone-manager-main-window-bg)',
        'zone-manager-top-control-bg': 'var(--color-zone-manager-top-control-bg)',
        'zone-manager-top-control-object-count-bg':
          'var(--color-zone-manager-top-control-object-count-bg)',
        'zone-manager-top-tile-title-icon': 'var(--color-zone-manager-top-tile-title-icon)',
      },
    },
  },
  plugins: [forms],
} satisfies Config;
