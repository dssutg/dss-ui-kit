import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectFiles, REPOSITORY_ROOT } from './lib/source-tree.ts';

/**
 * The layering rule: what each directory is allowed to import.
 *
 * The library is consumed by more than one application, and the constraint that follows from that
 * is not stylistic. Code that is convenient inside one application and unreachable from a package is
 * not code this library may keep, so where a module may reach from has to be decided once and checked
 * mechanically rather than reviewed file by file. This test is that decision.
 *
 * The one direction nothing in the tree uses is the one the rule forbids: nothing in `src/lib/`
 * imports `src/components/`. Helpers do not know what renders them. A helper that starts needing a
 * component is a component, and it moves.
 */
/** The layers the source tree is divided into. */
type LayerName = 'lib' | 'components' | 'icons' | 'infrastructure' | 'locales' | 'index';

const LAYERS: Record<LayerName, { allows: readonly LayerName[] }> = {
  /** Hooks and framework-agnostic helpers. Knows about nothing but its own directory. */
  lib: { allows: ['lib'] },
  /** Components. May use the helpers, each other, the icon paths and the infrastructure modules. */
  components: { allows: ['lib', 'components', 'icons', 'infrastructure'] },
  /** Generated icon path data. Data, not code: it imports nothing. */
  icons: { allows: ['icons'] },
  /** The four modules a component is allowed to reach the application through. */
  infrastructure: { allows: ['lib', 'infrastructure', 'locales'] },
  /** The message catalogues and the date data they carry. */
  locales: { allows: ['lib', 'locales'] },
  /** The public surface. May import anything, because that is the point of it. */
  index: { allows: ['lib', 'components', 'icons', 'infrastructure', 'locales', 'index'] },
};

type Layer = LayerName;

/** The modules a component may reach the application through. They are named rather than wildcarded. */
const INFRASTRUCTURE_MODULES = [
  'src/locale.tsx',
  'src/theme.tsx',
  'src/event.tsx',
  'src/feature_flag.tsx',
];

/** Which layer a source file belongs to. */
function layerOf(path: string): Layer {
  if (path === 'src/index.ts') return 'index';
  if (path.startsWith('src/lib/')) return 'lib';
  if (path.startsWith('src/components/')) return 'components';
  if (path.startsWith('src/icons/')) return 'icons';
  if (path.startsWith('src/locales/')) return 'locales';
  if (INFRASTRUCTURE_MODULES.includes(path)) return 'infrastructure';
  return 'index';
}

/** Every source file under `src`, so a specifier can be resolved to the file it names. */
const SOURCE_FILES = new Set(
  collectFiles('src').filter((path) => path.endsWith('.ts') || path.endsWith('.tsx')),
);

/** The import specifier of every import in a source file. */
function importSpecifiers(text: string): string[] {
  return [...text.matchAll(/(?:from|import)\s+["']([^"']+)["']/g)].flatMap((match) => [
    // The capture group always participates when the pattern matches, but the compiler does not know
    // that, and an assertion here would guard a test rather than the code the test is about.
    ...(match[1] === undefined ? [] : [match[1]]),
  ]);
}

/** Resolves a `./` or `../` specifier against the file it appears in. */
function resolveRelative(specifier: string, fromPath: string): string {
  const withoutExtension = specifier.replace(/\.[a-z]+$/, '');
  const parts = fromPath.split('/').slice(0, -1);

  for (const segment of withoutExtension.split('/')) {
    if (segment === '.') continue;
    if (segment === '..') parts.pop();
    else parts.push(segment);
  }

  return parts.join('/');
}

/** Resolves an `@/` or relative specifier to a repository-relative path, or `undefined` if it is not ours. */
function resolveSpecifier(specifier: string, fromPath: string): string | undefined {
  const withoutExtension = specifier.replace(/\.[a-z]+$/, '');

  let resolved: string;

  if (specifier.startsWith('@/')) {
    resolved = `src/${withoutExtension.slice(2)}`;
  } else if (specifier.startsWith('./') || specifier.startsWith('../')) {
    resolved = resolveRelative(specifier, fromPath);
  } else {
    return undefined;
  }

  // An import specifier carries no extension, so the layer is looked up on the file it names.
  return SOURCE_FILES.has(resolved) ? resolved : `${resolved}.tsx`;
}

/** One message per import that crosses a layer it is not allowed to cross. */
function findForbiddenImports(): string[] {
  const offenders: string[] = [];

  for (const path of collectFiles('src')) {
    if (!path.endsWith('.ts') && !path.endsWith('.tsx')) continue;

    const layer = layerOf(path);
    const allowed = LAYERS[layer].allows;
    const text = readFileSync(join(REPOSITORY_ROOT, path), 'utf8');

    for (const specifier of importSpecifiers(text)) {
      const target = resolveSpecifier(specifier, path);
      if (target === undefined) continue;

      const targetLayer = layerOf(target);
      if (allowed.includes(targetLayer)) continue;

      offenders.push(`${path} imports ${target} (${layer} may not import ${targetLayer})`);
    }
  }

  return offenders;
}

describe('module boundaries', () => {
  it('keeps every import inside the layer that allows it', () => {
    expect(findForbiddenImports()).toEqual([]);
  });

  it('keeps nothing in src/lib/ importing a component', () => {
    // Stated separately because it is the direction nothing in the tree currently uses, and the one
    // that would turn a helper into a component. A helper that needs a component is a component.
    const offenders = collectFiles('src/lib')
      .filter((path) => path.endsWith('.ts') || path.endsWith('.tsx'))
      .filter((path) => {
        const text = readFileSync(join(REPOSITORY_ROOT, path), 'utf8');

        return importSpecifiers(text).some((specifier) => specifier.startsWith('@/components/'));
      });

    expect(offenders).toEqual([]);
  });
});
