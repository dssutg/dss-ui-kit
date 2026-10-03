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
declare module '*.txt?raw' {
  const content: string;
  export default content;
}

declare module '*.glsl?raw' {
  const content: string;
  export default content;
}
