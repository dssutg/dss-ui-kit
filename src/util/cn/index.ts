import { type ClassNameValue, twMerge } from 'tailwind-merge';

/**
 * Joins class names so that the caller's win where the component already said something.
 *
 * Concatenating is what a component that builds its class string with a template literal does, and it
 * loses: two classes that set the same property are decided by which one the CSS happened to write
 * last, not by which one the caller passed. `twMerge` keeps the last of the conflicting pair, so
 * `cn('opacity-[0.4]', className)` renders at the opacity the caller asked for and at the component's
 * default when they did not ask for one.
 *
 * It is a merge and not a join: unrelated classes are all kept, which is the whole of what a caller
 * adding `w-1/2` to a component's padding expects.
 */
export function cn(...classNames: ClassNameValue[]): string {
  return twMerge(classNames);
}
