import { afterAll, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const SCRIPT = resolve(import.meta.dir, '../scripts/release-version.ts');
const workspace = mkdtempSync(join(tmpdir(), 'release-version-'));
afterAll(() => rmSync(workspace, { recursive: true, force: true }));

const CHANGELOG = `# Changelog

## [Unreleased]

### Added

- Something new.

## [1.0.1] - 2026-10-01

- Old.

[Unreleased]: https://github.com/o/r/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/o/r/compare/v1.0.0...v1.0.1
`;
const PACKAGE_JSON = '{\n  "name": "fixture",\n  "version": "1.0.1"\n}\n';

let counter = 0;

function git(dir: string, ...args: string[]): string {
  const run = Bun.spawnSync(
    [
      'git',
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.com',
      '-c',
      'commit.gpgsign=false',
      ...args,
    ],
    {
      cwd: dir,
      env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' },
    }
  );
  if (run.exitCode !== 0) throw new Error(`git ${args.join(' ')}: ${run.stderr.toString()}`);
  return run.stdout.toString();
}

/** A repository with `main` at 1.0.1 and a `feature` branch carrying the given commits. */
function repository(subjects: string[], changelog = CHANGELOG): string {
  counter += 1;
  const dir = join(workspace, `repo-${counter}`);
  mkdirSync(dir);
  git(dir, 'init', '-q', '-b', 'main');
  writeFileSync(join(dir, 'package.json'), PACKAGE_JSON);
  writeFileSync(join(dir, 'CHANGELOG.md'), changelog);
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'chore: initial');
  git(dir, 'checkout', '-q', '-b', 'feature');
  for (const subject of subjects) git(dir, 'commit', '-q', '--allow-empty', '-m', subject);
  return dir;
}

function run(dir: string, ...args: string[]) {
  const result = Bun.spawnSync(
    [process.execPath, SCRIPT, '--root', dir, '--base', 'main', '--date', '2026-10-09', ...args],
    { stdout: 'pipe', stderr: 'pipe' }
  );
  return { code: result.exitCode, output: result.stdout.toString() + result.stderr.toString() };
}

const read = (dir: string, file: string) => readFileSync(join(dir, file), 'utf8');

describe('release-version plan', () => {
  test('shows the plan from the commits and changes nothing', () => {
    const dir = repository(['feat(jobs): add a filter', 'fix: stop the flash', 'docs: tidy']);
    const { code, output } = run(dir);
    expect(code).toBe(0);
    expect(output).toContain('base      main @ 1.0.1');
    expect(output).toContain('minor → 1.1.0');
    expect(output).toContain('feat(jobs): add a filter');
    expect(read(dir, 'package.json')).toBe(PACKAGE_JSON);
    expect(read(dir, 'CHANGELOG.md')).toBe(CHANGELOG);
  });

  test('ignores merge commits and the base branch history', () => {
    const dir = repository(['fix: on the feature']);
    git(dir, 'checkout', '-q', 'main');
    git(dir, 'commit', '-q', '--allow-empty', '-m', 'feat!: only on main');
    git(dir, 'checkout', '-q', 'feature');
    git(dir, 'merge', '-q', '--no-ff', 'main', '-m', "Merge branch 'main' into feature");
    const { code, output } = run(dir);
    expect(code).toBe(0);
    expect(output).toContain('1 on top of the base');
    expect(output).toContain('patch → 1.0.2');
    expect(output).not.toContain('only on main');
  });

  test('a branch with no releasable commit is not a release', () => {
    const { code, output } = run(repository(['docs: a', 'ci: b']));
    expect(code).toBe(0);
    expect(output).toContain('none: nothing releasable, stays 1.0.1');
  });
});

describe('release-version --write', () => {
  test('bumps package.json, rolls the changelog and then passes --check', () => {
    const dir = repository(['feat: add a filter']);
    expect(run(dir, '--check').code).toBe(1);

    const written = run(dir, '--write');
    expect(written.code).toBe(0);
    expect(written.output).toContain('Wrote 1.1.0');
    expect(read(dir, 'package.json')).toBe(PACKAGE_JSON.replace('1.0.1', '1.1.0'));
    expect(read(dir, 'CHANGELOG.md')).toContain(
      '## [Unreleased]\n\n## [1.1.0] - 2026-10-09\n\n### Added'
    );
    expect(read(dir, 'CHANGELOG.md')).toContain(
      '[1.1.0]: https://github.com/o/r/compare/v1.0.1...v1.1.0'
    );

    expect(run(dir, '--check').code).toBe(0);
    const again = run(dir, '--write');
    expect(again.code).toBe(0);
    expect(again.output).toContain('Already up to date.');
  });

  test('follows the commits when the level rises after a first run', () => {
    const dir = repository(['fix: a']);
    run(dir, '--write');
    expect(read(dir, 'package.json')).toContain('"version": "1.0.2"');
    git(dir, 'commit', '-q', '--allow-empty', '-m', 'feat: b');
    expect(run(dir, '--check').code).toBe(1);
    expect(run(dir, '--write').code).toBe(0);
    expect(read(dir, 'package.json')).toContain('"version": "1.1.0"');
    expect(read(dir, 'CHANGELOG.md')).not.toContain('1.0.2');
    expect(run(dir, '--check').code).toBe(0);
  });

  test('refuses a commit that is not a Conventional Commit and edits nothing', () => {
    const dir = repository(['feat: ok', 'Add the other thing']);
    const { code, output } = run(dir, '--write');
    expect(code).toBe(1);
    expect(output).toContain('"Add the other thing" is not a Conventional Commit');
    expect(read(dir, 'package.json')).toBe(PACKAGE_JSON);
    expect(read(dir, 'CHANGELOG.md')).toBe(CHANGELOG);
  });

  test('refuses to release with nothing under Unreleased', () => {
    const empty = CHANGELOG.replace('### Added\n\n- Something new.\n\n', '');
    const dir = repository(['fix: a'], empty);
    const { code, output } = run(dir, '--write');
    expect(code).toBe(1);
    expect(output).toContain('Nothing under "## [Unreleased]"');
    expect(read(dir, 'package.json')).toBe(PACKAGE_JSON);
  });

  test('honours a Release-As footer', () => {
    const dir = repository(['feat: a\n\nRelease-As: 2.0.0-rc.1']);
    expect(run(dir, '--write').code).toBe(0);
    expect(read(dir, 'package.json')).toContain('"version": "2.0.0-rc.1"');
    expect(read(dir, 'CHANGELOG.md')).toContain('## [2.0.0-rc.1] - 2026-10-09');
  });
});

describe('release-version --check', () => {
  test('passes a documentation-only branch that leaves the version alone', () => {
    expect(run(repository(['docs: a']), '--check').code).toBe(0);
  });

  test('fails a hand-edited version that no commit justifies', () => {
    const dir = repository(['docs: a']);
    writeFileSync(join(dir, 'package.json'), PACKAGE_JSON.replace('1.0.1', '1.0.2'));
    const { code, output } = run(dir, '--check');
    expect(code).toBe(1);
    expect(output).toContain('must stay 1.0.1');
  });

  test('fails when the release tag already exists', () => {
    const dir = repository(['feat: a']);
    run(dir, '--write');
    git(dir, 'tag', 'v1.1.0');
    const { code, output } = run(dir, '--check');
    expect(code).toBe(1);
    expect(output).toContain('v1.1.0 is already tagged');
  });

  test('tells the author how to fix drift', () => {
    expect(run(repository(['fix: a']), '--check').output).toContain('bun run release:version');
  });
});

describe('release-version usage errors', () => {
  test('rejects --check together with --write', () => {
    const { code, output } = run(repository([]), '--check', '--write');
    expect(code).toBe(1);
    expect(output).toContain('Choose one of --check and --write');
  });

  test('reports an unknown base ref', () => {
    const dir = repository([]);
    const result = Bun.spawnSync([process.execPath, SCRIPT, '--root', dir, '--base', 'nope'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain('Base ref not found (nope)');
  });
});
