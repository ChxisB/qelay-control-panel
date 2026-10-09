#!/usr/bin/env bun
// Derives the next SemVer version (https://semver.org) from the Conventional Commits a branch
// adds on top of its base, and keeps package.json and CHANGELOG.md in step with it.
//
//   bun scripts/release-version.ts            show the plan, change nothing
//   bun scripts/release-version.ts --write    bump package.json and roll CHANGELOG.md
//   bun scripts/release-version.ts --check    exit 1 when the branch carries the wrong version
//
// --base <ref>   what the branch is measured against (default: origin/main, then main)
// --root <dir>   repository to inspect (default: this one)
// --date <date>  heading date for the new CHANGELOG section (default: today)

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { planRelease } from './releasePlan';
import { applyRelease } from './releaseWrite';
import type { Plan } from './releasePlan';

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    base: { type: 'string' },
    root: { type: 'string' },
    date: { type: 'string' },
    check: { type: 'boolean', default: false },
    write: { type: 'boolean', default: false },
  },
});

const root = resolve(values.root ?? resolve(import.meta.dir, '..'));

function git(args: string[]): { ok: boolean; out: string } {
  const run = Bun.spawnSync(['git', ...args], { cwd: root, stdout: 'pipe', stderr: 'pipe' });
  return { ok: run.exitCode === 0, out: run.stdout.toString() };
}

function resolveBase(): string {
  const candidates = values.base ? [values.base] : ['origin/main', 'main'];
  const found = candidates.find((ref) => git(['rev-parse', '-q', '--verify', `${ref}^{commit}`]).ok);
  if (!found) throw new Error(`Base ref not found (${candidates.join(', ')}). Pass --base <ref>.`);
  return found;
}

function readVersionAt(ref: string): string {
  const file = git(['show', `${ref}:package.json`]);
  if (!file.ok) throw new Error(`Cannot read package.json at ${ref}.`);
  return (JSON.parse(file.out) as { version: string }).version;
}

function commitsSince(ref: string) {
  const log = git(['log', '--no-merges', '--format=%H%x1f%B%x1e', `${ref}..HEAD`]);
  if (!log.ok) throw new Error(`git log ${ref}..HEAD failed.`);
  return log.out
    .split('\x1e')
    .map((record) => record.trim())
    .filter((record) => record !== '')
    .map((record) => {
      const [sha, message] = record.split('\x1f');
      return { sha, message: message.trim() };
    });
}

function today(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function show(plan: Plan, base: string, baseVersion: string, currentVersion: string): void {
  console.log(`base      ${base} @ ${baseVersion}`);
  console.log(`current   package.json ${currentVersion}`);
  console.log(`commits   ${plan.commits.length} on top of the base`);
  for (const commit of plan.commits) {
    console.log(`  ${(commit.level ?? '?').padEnd(5)} ${commit.sha.slice(0, 7)} ${commit.subject}`);
  }
  const verdict = plan.releasing
    ? `${plan.releaseAs ? 'Release-As' : plan.level} → ${plan.expected}`
    : `none: nothing releasable, stays ${plan.expected}`;
  console.log(`release   ${verdict}`);
  for (const problem of [...plan.blocking, ...plan.drift]) console.log(`problem   ${problem}`);
}

function main(): number {
  if (values.check && values.write) throw new Error('Choose one of --check and --write.');
  const base = resolveBase();
  const baseVersion = readVersionAt(base);
  const packageJson = readFileSync(resolve(root, 'package.json'), 'utf8');
  const changelog = readFileSync(resolve(root, 'CHANGELOG.md'), 'utf8');
  const currentVersion = (JSON.parse(packageJson) as { version: string }).version;
  const plan = planRelease({
    baseVersion,
    currentVersion,
    commits: commitsSince(base),
    changelog,
    tagExists: (version) => git(['rev-parse', '-q', '--verify', `refs/tags/v${version}`]).ok,
  });
  show(plan, base, baseVersion, currentVersion);

  const problems = plan.blocking.length + plan.drift.length;
  if (values.check) {
    if (problems === 0) return 0;
    if (plan.blocking.length === 0) console.log('Run `bun run release:version` and commit the result.');
    return 1;
  }
  if (!values.write) return 0;
  if (plan.blocking.length > 0) return 1;
  if (plan.drift.length === 0) {
    console.log('Already up to date.');
    return 0;
  }
  if (!plan.releasing) {
    console.log(`Nothing to release. Set package.json back to ${plan.expected} by hand.`);
    return 1;
  }
  const written = applyRelease({
    packageJson,
    changelog,
    baseVersion,
    currentVersion,
    expected: plan.expected,
    date: values.date ?? today(),
  });
  writeFileSync(resolve(root, 'package.json'), written.packageJson);
  writeFileSync(resolve(root, 'CHANGELOG.md'), written.changelog);
  console.log(`Wrote ${plan.expected} to package.json and CHANGELOG.md. Review, then commit both.`);
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
