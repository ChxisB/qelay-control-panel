#!/usr/bin/env bun
/**
 * The Firefox/WebKit CI jobs run inside mcr.microsoft.com/playwright:v<version>,
 * whose bundled browsers only match the same @playwright/test release. Fail fast
 * (e.g. on a Dependabot bump) instead of breaking with missing browser builds.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dir, '..');
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')) as {
  devDependencies?: Record<string, string>;
};
const version = pkg.devDependencies?.['@playwright/test'];
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  throw new Error('@playwright/test must be pinned to an exact version');
}
const workflow = await readFile(resolve(root, '.github/workflows/validation.yml'), 'utf8');
const images = [...workflow.matchAll(/mcr\.microsoft\.com\/playwright:v([^\s'"]+)/g)].map((m) => m[1]);
if (images.length === 0) throw new Error('validation.yml no longer uses the Playwright image');
for (const tag of images) {
  if (tag !== `${version}-noble`) {
    throw new Error(`Playwright image v${tag} must match @playwright/test ${version} (use v${version}-noble)`);
  }
}
console.log(`Playwright image matches @playwright/test ${version}.`);
