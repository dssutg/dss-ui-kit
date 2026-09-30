// Tell TypeScript compiler to allow to import formats below

declare module '*.png';
declare module '*.svg';
declare module '*.jpeg';
declare module '*.jpg';

// Vite and the consumer's bundler turn a stylesheet import into a side effect with no exports, and
// TypeScript has no way to know that from the file extension alone.
declare module '*.css';

declare module '*.txt?raw' {
  const content: string;
  export default content;
}

declare module '*.glsl?raw' {
  const content: string;
  export default content;
}
