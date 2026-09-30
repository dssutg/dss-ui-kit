import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectFiles, REPOSITORY_ROOT } from './lib/source-tree.ts';

/**
 * The library carries no domain model.
 *
 * It was extracted from the original application, and the extraction is only finished when nothing of that
 * application's subject matter is left. A `BCPType`, a `TCOType`, a `RObjectState` or a `Sensor` in
 * a public signature is a defect with a specific failure mode: it names a type no consumer of the
 * package can satisfy, so the component is not actually generic over its data — it is generic over
 * *our* data, and the second consumer has to fork it.
 *
 * The rule is therefore stated positively. A component models the shape it actually renders and lets
 * the caller adapt, which is what makes it reusable rather than merely exported.
 *
 * This is checked by walking the tree rather than left to review. A coupling that cannot be written
 * without being seen is one that will be written.
 */

/**
 * Modules of the application that were never copied here, and that therefore may not be imported.
 *
 * They are listed by name even though the files do not exist: the import is the defect, and a
 * relative path to a file that is absent is still a coupling to the application.
 */
const FORBIDDEN_MODULES = [
  '@/def',
  '@/api',
  '@/contact',
  '@/robject',
  '@/sensor',
  '@/server_nd_type',
  '@/routing',
  '@/locale_schema',
  '@/main',
  '@/the original application',
];

/**
 * Type names that name the application's subject matter.
 *
 * Matched as whole words so an unrelated identifier that merely contains one is not a false
 * positive, and so `Sensor` catches the type without catching `SensorMount` in a comment about
 * something else entirely.
 */
const DOMAIN_TYPE_NAMES = [
  'BCPType',
  'TCOType',
  'RObject',
  'RObjectState',
  'Sensor',
  'SensorType',
  'SensorState',
  'Server',
  'KauConfig',
  'KauSlot',
  'KLWD',
  'BcpTypeName',
  'TcoTypeName',
];

/** How each rule is described in a failure message, so one tells the reader what to do about it. */
const RULES = [
  {
    name: 'an import of an application module',
    pattern: (text: string) =>
      FORBIDDEN_MODULES.filter((module) =>
        new RegExp(`from\\s+["'\`]${module.replace('/', '\\/')}(["'\`/])`).test(text),
      ),
  },
  {
    name: 'a domain type name',
    pattern: (text: string) =>
      DOMAIN_TYPE_NAMES.filter((type) => new RegExp(`\\b${type}\\b`).test(text)),
  },
];

/** One message per rule violation, naming the file and what was found. */
function findDomainCode(): string[] {
  const offenders: string[] = [];

  for (const path of collectFiles('src')) {
    if (!path.endsWith('.ts') && !path.endsWith('.tsx')) continue;
    if (path.endsWith('.test.ts') || path.endsWith('.test.tsx')) continue;

    const text = readFileSync(join(REPOSITORY_ROOT, path), 'utf8');

    for (const rule of RULES) {
      const found = rule.pattern(text);

      if (found.length > 0) {
        offenders.push(`${path}: ${rule.name} — ${found.join(', ')}`);
      }
    }
  }

  return offenders;
}

/** The public surface, which is what a consumer actually sees. */
function publicSurfaceText(): string {
  return readFileSync(join(REPOSITORY_ROOT, 'src/index.ts'), 'utf8');
}

describe('no domain code', () => {
  it('keeps the application domain out of the source tree', () => {
    expect(findDomainCode()).toEqual([]);
  });

  it('keeps the application domain out of the public surface', () => {
    // Stated separately because it is the one that matters most: a domain type reached through
    // `src/index.ts` is a type a consumer is expected to satisfy, and nobody outside this
    // repository can.
    const text = publicSurfaceText();

    for (const rule of RULES) {
      expect(rule.pattern(text), `the public surface must not contain ${rule.name}`).toEqual([]);
    }
  });
});
