#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BundledIcon } from './util/icon-bundle.ts';
import {
  isValidIconName,
  readSvgGeometry,
  renderIconPathModule,
  roundPathData,
} from './util/icon-bundle.ts';
import { REPOSITORY_ROOT } from './util/source-tree.ts';

/**
 * Bundles the source SVGs into `src/icons/index.tsx`, the path data every icon is drawn from.
 *
 * Run it through `deno task icons`. The generated module is committed rather than built, because a
 * consumer installs the package rather than this repository: the path data of an icon is data the
 * library ships, not something it derives at load time, and `IconName` is the union of the keys of
 * that module — a type derived from a build step is a type a consumer's editor cannot see.
 *
 * The SVGs beside it are the source of truth and this script is the only thing that writes the
 * module, so an SVG added, edited or removed is bundled by running this; a commit that changed an
 * SVG without regenerating ships the icon as it was.
 *
 * The rules it holds the artwork to are what `Icon` can draw rather than what an SVG may be: one
 * `<path>`, on a 100 by 100 canvas, because `Icon` builds the `<svg>` itself and points one path
 * into it. A source that breaks a rule is refused with the geometry it declared rather than bundled
 * into an icon that would render as nothing.
 *
 * The module is written and then formatted, because Biome is the only formatter here and it owns
 * formatting everywhere else — including this file. Reimplementing its line breaking to save one
 * subprocess would put a second opinion about the layout of the file in this repository.
 */

const ICONS_DIRECTORY = join(REPOSITORY_ROOT, 'src', 'icons');
const MODULE_PATH = join(ICONS_DIRECTORY, 'index.tsx');

/**
 * Every source SVG in the icons directory, by file name.
 *
 * A `.SVG` is reported rather than read: two spellings of one extension is a difference between the
 * artwork this script sees and the artwork it was given, and it is the kind that sorts first on one
 * filesystem and not on another.
 */
function collectIconFiles(): string[] {
  return readdirSync(ICONS_DIRECTORY).filter((file) => {
    if (file.endsWith('.svg')) return true;

    if (file.toLowerCase().endsWith('.svg')) {
      throw new Error(`${file} must have a lowercase .svg extension`);
    }

    return false;
  });
}

/** Reads one SVG as the icon it is, reporting the file in whatever went wrong with it. */
function readIcon(fileName: string): BundledIcon {
  const name = fileName.slice(0, -'.svg'.length);

  if (!isValidIconName(name)) {
    throw new Error(
      `${fileName}: "${name}" is not a usable icon name. A name is what a caller passes to a ` +
        '`name` prop and what ends up in a DOM id, so it holds letters and digits only.',
    );
  }

  try {
    const geometry = readSvgGeometry(readFileSync(join(ICONS_DIRECTORY, fileName), 'utf8'));
    return { name, pathData: roundPathData(geometry.pathData) };
  } catch (error) {
    throw new Error(`${fileName}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Formats the module that was just written, so the generated file is the one `deno task format`
 * would have produced.
 *
 * Only this one path is passed to the formatter: a generation step that reformatted the repository
 * would take a contributor's unrelated work and fold it into the diff that added an icon.
 */
function formatGeneratedModule(): void {
  const { code, stderr } = new Deno.Command('deno', {
    args: ['run', '-A', 'npm:@biomejs/biome', 'format', '--write', MODULE_PATH],
    cwd: REPOSITORY_ROOT,
    stdout: 'piped',
    stderr: 'piped',
  }).outputSync();

  if (code !== 0) {
    console.error(new TextDecoder().decode(stderr));
    throw new Error(
      'Biome could not format the generated module — the module above is unformatted',
    );
  }
}

function main(): void {
  const icons = collectIconFiles().map(readIcon);

  if (icons.length === 0) {
    throw new Error(`${ICONS_DIRECTORY} holds no .svg files to bundle`);
  }

  writeFileSync(MODULE_PATH, renderIconPathModule(icons));
  formatGeneratedModule();

  console.log(`Bundled ${icons.length} icons into src/icons/index.tsx`);
}

if (import.meta.main) {
  try {
    main();
  } catch (error) {
    console.error(`\n✖ ${error instanceof Error ? error.message : String(error)}`);
    Deno.exit(1);
  }
}
