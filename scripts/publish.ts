#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run --allow-env
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { collectFiles, REPOSITORY_ROOT } from './util/source-tree.ts';

/**
 * Prepares and runs the JSR publish.
 *
 * JSR serves TypeScript source, so the package publishes `src/` exactly as the repository holds it.
 * The repository's own conventions — the `@/` alias with extensionless directory entries, `react`
 * written for the `preact/compat` alias, bare npm specifiers — are what the bundler and the type
 * checker resolve here (see `vite.config.ts` and `tsconfig.json`), while `deno publish` resolves
 * them with the imports map of the package config it is pointed at and no other map. Since the dev
 * config `deno.json` is not that file — a real `deno.json` beats a sibling `jsr.json` — this script
 * writes a self-contained `jsr.json` from two sources and publishes with `-c`:
 *
 * - `package.json` gives the version and the licence (the release script owns the version; the JSR
 *   copy of it is never edited by hand) and `deno.lock` gives the exact installed version every npm
 *   specifier in the map is pinned to;
 * - the module graph of the published files gives the rest of the imports map: every `@/` alias
 *   resolves to the exact file it names (with the directory entry's `index.*` included), the npm
 *   dependencies are pinned from the manifest, and the `react` imports are aliased onto the pinned
 *   Preact compat subpaths — the same mapping the bundle keeps external.
 *
 * A specifier that resolves to nothing is an error rather than a silent skip: a published package
 * whose module graph cannot load is worse than a publish that stops. The generated `jsr.json` is a
 * build artefact and is gitignored; a stale one resolves against files that have since moved, so it
 * is written fresh on every publish and never committed.
 *
 * The exports carry no CSS subpath. JSR's exports map names module entry points only — a `.css`
 * value fails the publish check — yet the stylesheets are shipped as package files, so a consumer's
 * Tailwind or PostCSS pipeline reads them from the package by path. That is the JSR reading of the
 * `./style.css` subpath the npm manifest spells.
 *
 * With `--dry-run` the config is written but nothing is uploaded; the flag is passed on to the
 * publish command, which stops short of contacting the registry.
 */

const JSR_JSON = 'jsr.json';
const PACKAGE_JSON = 'package.json';

/**
 * The paths the publish leaves out, as repository-relative prefixes and globs.
 *
 * One list feeds both halves: the `publish.exclude` of the generated config, and the file set the
 * imports map is derived from — a file the package does not carry cannot import anything for the
 * map to resolve.
 */
const PUBLISH_EXCLUDE: readonly string[] = [
  'src/**/*.test.ts',
  'src/**/*.test.tsx',
  // The test-only render helper imports `vitest`, which the package does not depend on; it is
  // reachable from the test files alone, so a package without it loses nothing.
  'src/util/testing',
];

/** The scope and package name the library publishes under on JSR. */
const JSR_PACKAGE_NAME = '@dssutg/dss-ui-kit';

/** The subpath entries besides the default export, mapped to the same files npm installs. */
const NAMED_EXPORTS: Readonly<Record<string, string>> = {
  './tailwind': './src/tailwind_preset.ts',
};

/** The files the publish carries: everything under `src/` plus the documents a package page shows. */
const PUBLISH_INCLUDE: readonly string[] = ['src', 'README.md', 'LICENSE'];

/**
 * The npm specifier an import of `react` resolves to.
 *
 * The library is written against the React API and runs on Preact through the compat layer (see
 * README.md), so the alias is the published package's reading of what `vite.config.ts` and
 * `tsconfig.json` map in this repository. Preact is the peer dependency a real consumer already
 * has, and its pinned version here is the same exact one `package.json` installs for the builds.
 */
function compatAlias(preactPin: string, subpath: string): string {
  return `npm:preact@${preactPin}/compat${subpath}`;
}

/** The `react`-family specifiers the source may import, and the Preact path each of them names. */
const REACT_TO_COMPAT: Readonly<Record<string, string>> = {
  react: '',
  'react-dom': '',
  'react/jsx-runtime': '/jsx-runtime',
  'react/jsx-dev-runtime': '/jsx-runtime',
  'react-dom/client': '/client',
  'react-dom/test-utils': '/test-utils',
};

/** The Preact specifiers the source may import, pinned to the same Preact the peer names. */
const PREACT_TO_NPM: Readonly<Record<string, string>> = {
  preact: '',
  'preact/compat': '/compat',
  'preact/compat/client': '/compat/client',
  'preact/test-utils': '/test-utils',
  'preact/jsx-runtime': '/jsx-runtime',
  'preact/hooks': '/hooks',
};

interface PackageManifest {
  readonly version?: string;
  readonly license?: string;
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly peerDependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
}

interface JsrConfig {
  readonly name: string;
  readonly version: string;
  readonly license: string;
  readonly exports: Readonly<Record<string, string>>;
  readonly publish: {
    readonly include: readonly string[];
    readonly exclude: readonly string[];
  };
  readonly imports: Readonly<Record<string, string>>;
}

/** Reads the package manifest fields the JSR config is derived from. */
function readManifest(): Required<Pick<PackageManifest, 'version' | 'license'>> & PackageManifest {
  const manifest = JSON.parse(
    readFileSync(join(REPOSITORY_ROOT, PACKAGE_JSON), 'utf8'),
  ) as PackageManifest;

  if (!manifest.version) {
    throw new Error(`No "version" field in ${PACKAGE_JSON}`);
  }
  if (!manifest.license) {
    throw new Error(`No "license" field in ${PACKAGE_JSON}`);
  }

  return manifest as Required<Pick<PackageManifest, 'version' | 'license'>> & PackageManifest;
}

/**
 * Extracts the static import specifiers of one source file.
 *
 * A light scan rather than a parser: the module graph is only needed to know which specifiers exist,
 * not how they bind, and the source follows the lint rule that every import is at the top of the
 * file. Matching from the start of the line keeps TSDoc examples — which spell the same specifiers
 * inside a comment — out of the graph, and `export * from` and `import(` both count, since a
 * specifier reached only dynamically is resolved the same static way on JSR.
 */
function extractSpecifiers(source: string): string[] {
  const specifiers: string[] = [];

  const patterns = [
    /^import\s+'([^']+)'/gm,
    /^import\s+[^;\n]*?\sfrom\s+'([^']+)'/gm,
    /^export\s+\{[^}]*?\}\s+from\s+'([^']+)'/gm,
    /^export\s+\*\s+from\s+'([^']+)'/gm,
    /import\(\s*'([^']+)'\s*\)/g,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1];
      if (specifier) specifiers.push(specifier);
    }
  }

  return specifiers;
}

/**
 * Resolves one `@/`-aliased specifier to the repository-relative file it names.
 *
 * The alias is extensionless for code, so the file is the specifier's path with an `index.*` inside
 * when the last segment is a directory and a concrete extension otherwise (`@/icons/index` names a
 * file directly). A specifier that ends in a real extension — the shader sources the text imports
 * read — is the file itself, and needs no candidate forms.
 */
function resolveAliasSpecifier(specifier: string): string | null {
  const path = `src/${specifier.slice(2)}`;

  if (/\.(glsl|txt)$/.test(path)) {
    try {
      readFileSync(join(REPOSITORY_ROOT, path));
      return `./${path}`;
    } catch {
      return null;
    }
  }

  for (const candidate of [`${path}.ts`, `${path}.tsx`, `${path}/index.ts`, `${path}/index.tsx`]) {
    try {
      readFileSync(join(REPOSITORY_ROOT, candidate));
      return `./${candidate}`;
    } catch {
      // Not this candidate — the loop tries the next shape.
    }
  }

  return null;
}

/**
 * Reads the version of one npm dependency out of the lockfile's specifier list.
 *
 * The published imports map has to pin the version, and `package.json` does not hold a single
 * number for every name: `preact` is a peer range, the dev dependencies are dev-only. The lockfile
 * is the record of what is actually installed, which is the version the sources are checked against.
 */
function readInstalledVersion(specifier: string): string | null {
  const lock = JSON.parse(readFileSync(join(REPOSITORY_ROOT, 'deno.lock'), 'utf8')) as {
    readonly specifiers?: Readonly<Record<string, string>>;
  };

  // The key is whatever range requested the package — `npm:preact@10.29.8`, `npm:preact@*` — so the
  // version is read off the matching key's text rather than looked up by an exact spelling.
  const prefix = `npm:${specifier}@`;
  for (const [key, resolution] of Object.entries(lock.specifiers ?? {})) {
    if (key.startsWith(prefix)) {
      return resolution.split('_')[0] ?? null;
    }
  }

  return null;
}

/**
 * Adds the `@/`-aliased specifiers of one source file to the imports map.
 *
 * The alias is extensionless by convention, so the file is the specifier's path with an
 * `index.*` inside when the last segment is a directory and a concrete extension otherwise
 * (`@/icons/index` names a file directly).
 */
function addAliasSpecifier(file: string, specifier: string, imports: Record<string, string>): void {
  const resolved = resolveAliasSpecifier(specifier);
  if (!resolved) {
    throw new Error(`${file} imports "${specifier}", which names no file under src/`);
  }
  imports[specifier] = resolved;
}

/**
 * Adds the bare npm specifiers of one source file to the imports map.
 *
 * The `react`-family specifiers are aliased onto the pinned preact compat subpath, the `preact`
 * specifiers are pinned directly, and any other name is pinned to the version `package.json`
 * declares for it.
 */
function addNpmSpecifier(
  specifier: string,
  manifest: PackageManifest,
  preactPin: string | null,
  imports: Record<string, string>,
): void {
  if (specifier in REACT_TO_COMPAT) {
    if (!preactPin) {
      throw new Error(`Cannot alias "react" — no preact peer found in ${PACKAGE_JSON}`);
    }
    imports[specifier] = compatAlias(preactPin, REACT_TO_COMPAT[specifier] ?? '');
    return;
  }

  const pin = PREACT_TO_NPM[specifier] ?? null;
  if (pin !== null || specifier === 'preact') {
    if (!preactPin) {
      throw new Error(`Cannot pin "${specifier}" — no preact peer found in ${PACKAGE_JSON}`);
    }
    imports[specifier] = `npm:preact@${preactPin}${pin}`;
    return;
  }

  const range =
    manifest.dependencies?.[specifier] ??
    manifest.peerDependencies?.[specifier] ??
    manifest.devDependencies?.[specifier];
  if (!range) {
    throw new Error(`The source imports "${specifier}", which is not declared in ${PACKAGE_JSON}`);
  }
  imports[specifier] = `npm:${specifier}@${range}`;
}

/**
 * Builds the imports map for the published package.
 *
 * Every specifier the published files import is either `@/`-aliased inside the package or a bare npm
 * name; anything else (relative imports are resolved by the package's own files, `vitest` and
 * `node:` only appear in excluded test files) is left for the publish to fail on — a silent skip
 * would publish a package whose module graph cannot load.
 *
 * The JSX runtime is in the map though it is in no source file: compiling a `.tsx` file with the
 * automatic runtime emits an import of `preact/jsx-runtime` that the source never spells, and it
 * resolves through the imports map like any other specifier.
 */
function buildImports(
  files: readonly string[],
  manifest: PackageManifest,
  preactPin: string,
): Record<string, string> {
  const imports: Record<string, string> = {
    'preact/jsx-runtime': `npm:preact@${preactPin}/jsx-runtime`,
  };

  for (const file of files) {
    const source = readFileSync(join(REPOSITORY_ROOT, file), 'utf8');
    for (const specifier of extractSpecifiers(source)) {
      if (specifier.startsWith('@/')) {
        addAliasSpecifier(file, specifier, imports);
      } else if (!specifier.startsWith('.') && specifier !== 'text') {
        addNpmSpecifier(specifier, manifest, preactPin, imports);
      }
    }
  }

  return imports;
}

/** Collects the files of the package — the publish's include minus its exclude — relative to root. */
function collectPackageFiles(): string[] {
  const excluded = new Set(PUBLISH_EXCLUDE.filter((pattern) => !pattern.includes('*')));

  return collectFiles('src').filter(
    (file) =>
      !file.endsWith('.test.ts') &&
      !file.endsWith('.test.tsx') &&
      ![...excluded].some((path) => file === path || file.startsWith(`${path}/`)),
  );
}

/** Writes the package config `deno publish` reads with `-c jsr.json`. */
function writeJsrConfig(): void {
  const manifest = readManifest();
  const preactPin = readInstalledVersion('preact');
  if (!preactPin) {
    throw new Error(`No installed version of the "preact" peer found in deno.lock`);
  }

  const config: JsrConfig = {
    name: JSR_PACKAGE_NAME,
    version: manifest.version,
    license: manifest.license,
    exports: { '.': './src/index.ts', ...NAMED_EXPORTS },
    publish: {
      include: PUBLISH_INCLUDE,
      exclude: PUBLISH_EXCLUDE,
    },
    imports: buildImports(collectPackageFiles(), manifest, preactPin),
  };

  Deno.writeTextFileSync(join(REPOSITORY_ROOT, JSR_JSON), `${JSON.stringify(config, null, 2)}\n`);
}

async function main(): Promise<void> {
  const dryRun = Deno.args.includes('--dry-run');

  writeJsrConfig();

  // `-c` is what makes the generated file the one the publish reads: a `deno.json` in the same
  // directory would win on its own, and only the generated file carries the publish rules.
  const publishArgs = dryRun
    ? ['publish', '--dry-run', '--allow-dirty', '-c', JSR_JSON]
    : ['publish', '-c', JSR_JSON];
  const command = new Deno.Command('deno', {
    args: publishArgs,
    cwd: REPOSITORY_ROOT,
    stdout: 'inherit',
    stderr: 'inherit',
  });
  const { code } = await command.output();

  if (code !== 0) {
    Deno.exit(code);
  }
}

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error(`\n✖ ${error instanceof Error ? error.message : String(error)}`);
    Deno.exit(1);
  }
}
