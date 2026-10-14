// SPDX-License-Identifier: MIT
// Checks the @ alias declared in vite.config.ts and tsconfig.json names the same files.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { REPOSITORY_ROOT } from './util/source-tree.ts';

/**
 * The `@` alias is declared twice, and the two halves have to name the same things.
 *
 * The bundler resolves `@/...` through `resolve.alias` in `vite.config.ts`; the type checker resolves
 * the same specifiers through `compilerOptions.paths` in `tsconfig.json`. When the two agree, an
 * import that type-checks also builds. When they drift, the failure is the worst kind: a suite passes
 * under the compiler or builds under the bundler's resolver and fails under the other's. Nothing
 * makes the two read each other, so they are compared here.
 *
 * The `@` target is checked as well as the key: a specifier can exist in both maps and still point at
 * different directories, which is a divergence the key set alone cannot see.
 */

/** Folds the directory-entry key form onto the alias name the bundler uses. */
function aliasName(pathKey: string): string {
  return pathKey.endsWith('/*') ? pathKey.slice(0, -2) : pathKey;
}

/** The properties of an object literal, by the name they are declared under. */
function objectProperties(object: ts.ObjectLiteralExpression): Map<string, ts.Expression> {
  const properties = new Map<string, ts.Expression>();

  for (const property of object.properties) {
    if (!ts.isPropertyAssignment(property)) {
      continue;
    }

    const name = property.name;
    const key = ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : undefined;

    if (key !== undefined) {
      properties.set(key, property.initializer);
    }
  }

  return properties;
}

/** The object literal a top-level property of the exported config object holds. */
function configObject(source: ts.SourceFile, propertyName: string): ts.ObjectLiteralExpression {
  const found = findObjectLiteral(source, propertyName, source);

  if (found === undefined) {
    throw new Error(`No object literal named "${propertyName}" in vite.config.ts`);
  }

  return found;
}

/** The first object literal assigned to `propertyName` anywhere below `node`. */
function findObjectLiteral(
  node: ts.Node,
  propertyName: string,
  source: ts.SourceFile,
): ts.ObjectLiteralExpression | undefined {
  if (
    ts.isPropertyAssignment(node) &&
    node.name.getText(source) === propertyName &&
    ts.isObjectLiteralExpression(node.initializer)
  ) {
    return node.initializer;
  }

  let result: ts.ObjectLiteralExpression | undefined;
  ts.forEachChild(node, (child) => {
    result ??= findObjectLiteral(child, propertyName, source);
  });

  return result;
}

/** The alias entries `vite.config.ts` declares, as name to the source text of its target. */
function viteAliases(): Map<string, string> {
  const text = readFileSync(join(REPOSITORY_ROOT, 'vite.config.ts'), 'utf8');
  const source = ts.createSourceFile('vite.config.ts', text, ts.ScriptTarget.Latest, true);
  const resolve = configObject(source, 'resolve');
  const alias = objectProperties(resolve).get('alias');

  if (alias === undefined || !ts.isObjectLiteralExpression(alias)) {
    throw new Error('vite.config.ts has no resolve.alias object');
  }

  return new Map(
    [...objectProperties(alias)].map(([name, value]) => [name, value.getText(source)]),
  );
}

/** The `compilerOptions.paths` entries `tsconfig.json` declares. */
function typescriptAliases(): Map<string, readonly string[]> {
  const config = JSON.parse(readFileSync(join(REPOSITORY_ROOT, 'tsconfig.json'), 'utf8')) as {
    readonly compilerOptions?: { readonly paths?: Readonly<Record<string, readonly string[]>> };
  };

  return new Map(Object.entries(config.compilerOptions?.paths ?? {}));
}

describe('the @ alias', () => {
  it('is declared with the same names in the bundler and the type checker', () => {
    const vite = [...viteAliases().keys()].sort();
    const typescript = [...typescriptAliases().keys()].map(aliasName).sort();

    expect(vite).toEqual(typescript);
  });

  it('points both halves at src', () => {
    expect(viteAliases().get('@')).toContain('./src/');
    expect(typescriptAliases().get('@/*')).toEqual(['./src/*']);
  });

  it('maps the whole React family onto Preact in both halves', () => {
    // The library is written against the React API and runs on Preact through the compat layer, so
    // every `react*` specifier has to resolve to a Preact module in the bundler and in the type
    // checker. Comparing the key sets above cannot see a target that was changed to something else,
    // and a `react` that resolves to a real React would put two renderers in one bundle.
    const isReactFamily = (name: string): boolean =>
      name === 'react' || name.startsWith('react/') || name.startsWith('react-');

    const viteOffenders = [...viteAliases()]
      .filter(([name, target]) => isReactFamily(name) && !target.includes('preact'))
      .map(([name, target]) => `${name} -> ${target}`);

    const typescriptOffenders = [...typescriptAliases()]
      .filter(([name, targets]) => isReactFamily(aliasName(name)) && !targets.some(isPreact))
      .map(([name, targets]) => `${name} -> ${targets.join(', ')}`);

    expect({ vite: viteOffenders, typescript: typescriptOffenders }).toEqual({
      vite: [],
      typescript: [],
    });
  });
});

/** Whether a `compilerOptions.paths` target points into the Preact package. */
function isPreact(path: string): boolean {
  return path.includes('preact');
}
