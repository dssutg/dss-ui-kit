// Ambient declarations for the non-code files the bundler can import. A component library ships
// source, so a consumer's build resolves these through its own bundler rather than ours.

declare module '*.svg';
declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';

// Vite and the consumer's bundler turn a stylesheet import into a side effect with no exports, and
// TypeScript has no way to know that from the file extension alone.
declare module '*.css';

// Text and shader source imported for their content rather than parsed as a module.

/**
 * The shader sources are imported with the standard text import attribute — the same syntax every
 * runtime of this package understands, including the JSR publish. A bundler that has no native
 * reading for the attribute only needs a plugin that maps it onto its own raw-text mechanism.
 */
declare module '*.glsl' {
  const content: string;
  export default content;
}
