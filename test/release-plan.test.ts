import { describe, expect, test } from 'bun:test';
import { planRelease } from '../scripts/releasePlan';
import type { PlanInput } from '../scripts/releasePlan';

const CHANGELOG = `# Changelog

## [Unreleased]

### Added

- A thing.

## [1.0.1] - 2026-10-01

- Old.
`;
const RELEASED = `${CHANGELOG.replace('## [1.0.1]', '## [1.1.0] - 2026-10-09\n\n- New.\n\n## [1.0.1]')}`;

function plan(messages: string[], overrides: Partial<PlanInput> = {}) {
  return planRelease({
    baseVersion: '1.0.1',
    currentVersion: '1.0.1',
    commits: messages.map((message, index) => ({ sha: `abcdef${index}0000`, message })),
    changelog: CHANGELOG,
    tagExists: () => false,
    ...overrides,
  });
}

describe('planRelease: the version a branch should carry', () => {
  test('no commits means no release and nothing to fix', () => {
    expect(plan([])).toMatchObject({
      level: 'none',
      expected: '1.0.1',
      releasing: false,
      blocking: [],
      drift: [],
    });
  });

  test('docs, ci and test commits alone do not release', () => {
    const result = plan(['docs: a', 'ci: b', 'test: c', 'chore: d']);
    expect(result).toMatchObject({ level: 'none', expected: '1.0.1', releasing: false, drift: [] });
  });

  test.each([
    [['fix: a'], 'patch', '1.0.2'],
    [['fix: a', 'docs: b'], 'patch', '1.0.2'],
    [['fix: a', 'feat: b'], 'minor', '1.1.0'],
    [['feat: a', 'fix: b', 'feat: c'], 'minor', '1.1.0'],
    [['fix: a', 'feat!: b'], 'major', '2.0.0'],
    [['docs: a\n\nBREAKING CHANGE: the page moved'], 'major', '2.0.0'],
  ] as const)('%j → %s → %s', (messages, level, expected) => {
    expect(plan([...messages])).toMatchObject({ level, expected, releasing: true, blocking: [] });
  });

  test('asks for the bump and the changelog section until both are there', () => {
    const { drift } = plan(['feat: a']);
    expect(drift).toEqual([
      'package.json is 1.0.1 but these commits release 1.1.0.',
      'CHANGELOG.md has no "## [1.1.0]" section.',
    ]);
  });

  test('is satisfied once package.json and the changelog carry the version', () => {
    const done = plan(['feat: a'], { currentVersion: '1.1.0', changelog: RELEASED });
    expect(done).toMatchObject({ blocking: [], drift: [] });
  });

  test('rejects a version bumped further or less than the commits justify', () => {
    expect(plan(['fix: a'], { currentVersion: '1.1.0', changelog: RELEASED }).drift[0]).toBe(
      'package.json is 1.1.0 but these commits release 1.0.2.'
    );
    expect(plan(['feat: a'], { currentVersion: '1.0.2' }).drift[0]).toContain('release 1.1.0');
  });

  test('rejects a hand bump when nothing is releasable', () => {
    expect(plan(['docs: a'], { currentVersion: '1.0.2' }).drift).toEqual([
      'package.json is 1.0.2 but no commit here is releasable, so it must stay 1.0.1.',
    ]);
  });

  test('blocks commits that are not Conventional Commits and names them', () => {
    const { blocking } = plan(['feat: ok', 'Add a thing']);
    expect(blocking).toHaveLength(1);
    expect(blocking[0]).toContain('abcdef1 "Add a thing" is not a Conventional Commit');
  });

  test('blocks a version that is already tagged', () => {
    const { blocking } = plan(['feat: a'], { tagExists: (version) => version === '1.1.0' });
    expect(blocking).toHaveLength(1);
    expect(blocking[0]).toContain('v1.1.0 is already tagged');
  });

  test('does not look at tags when nothing releases', () => {
    expect(plan(['docs: a'], { tagExists: () => true }).blocking).toEqual([]);
  });

  test('blocks versions that are not SemVer', () => {
    expect(plan([], { baseVersion: '1.0' }).blocking[0]).toContain('base version "1.0"');
    expect(plan([], { currentVersion: 'v1.0.1' }).blocking[0]).toContain(
      'package.json version "v1.0.1"'
    );
  });
});

describe('planRelease: pre-releases and Release-As', () => {
  test('a Release-As footer pins the version', () => {
    const result = plan(['feat: a\n\nRelease-As: 3.0.0'], {
      currentVersion: '3.0.0',
      changelog: CHANGELOG.replace('## [1.0.1]', '## [3.0.0] - 2026-10-09\n\n## [1.0.1]'),
    });
    expect(result).toMatchObject({
      expected: '3.0.0',
      releaseAs: '3.0.0',
      releasing: true,
      blocking: [],
      drift: [],
    });
  });

  test('Release-As alone releases even when no commit is releasable', () => {
    expect(plan(['docs: a\n\nRelease-As: 1.2.0'])).toMatchObject({
      level: 'none',
      expected: '1.2.0',
      releasing: true,
    });
  });

  test('Release-As can ship the base version when it was never tagged', () => {
    const result = plan(['feat: rebrand\n\nRelease-As: 1.0.1']);
    expect(result).toMatchObject({ expected: '1.0.1', releasing: true, blocking: [], drift: [] });
    expect(
      plan(['feat: rebrand\n\nRelease-As: 1.0.1'], { tagExists: () => true }).blocking[0]
    ).toContain('v1.0.1 is already tagged');
  });

  test.each([
    ['0.9.0', 'is lower than the base version 1.0.1'],
    ['1.2', 'is not a valid SemVer version'],
    ['1.2.0+build.5', 'is not a valid SemVer version'],
    ['v1.2.0', 'is not a valid SemVer version'],
  ])('rejects Release-As %s', (pinned, reason) => {
    expect(plan([`feat: a\n\nRelease-As: ${pinned}`]).blocking[0]).toContain(reason);
  });

  test('a pre-release base needs Release-As to choose what comes next', () => {
    const base = { baseVersion: '1.1.0-rc.1', currentVersion: '1.1.0-rc.1' };
    expect(plan(['fix: a'], base).blocking[0]).toContain('is a pre-release');
    expect(plan(['fix: a\n\nRelease-As: 1.1.0-rc.2'], base).expected).toBe('1.1.0-rc.2');
    expect(plan(['docs: a'], base)).toMatchObject({ blocking: [], drift: [] });
  });

  test('a pre-release can be released as a normal version with Release-As', () => {
    const result = plan(['fix: a\n\nRelease-As: 1.1.0'], {
      baseVersion: '1.1.0-rc.2',
      currentVersion: '1.1.0-rc.2',
    });
    expect(result).toMatchObject({ expected: '1.1.0', blocking: [] });
  });
});
