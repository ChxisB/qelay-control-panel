import { describe, expect, test } from 'bun:test';
import {
  hasSection,
  retitleSection,
  rollChangelog,
  unreleasedBody,
} from '../scripts/changelogRelease';
import { applyRelease } from '../scripts/releaseWrite';

const REPO = 'https://github.com/owner/repo';
const CHANGELOG = `# Changelog

Intro text.

## [Unreleased]

### Added

- A new thing.

### Fixed

- A bug.

## [1.0.1] - 2026-10-01

### Removed

- Old.

[Unreleased]: ${REPO}/compare/v1.0.1...HEAD
[1.0.1]: ${REPO}/compare/v1.0.0...v1.0.1
`;
const EMPTY = CHANGELOG.replace(
  /## \[Unreleased\][\s\S]*?(?=## \[1\.0\.1\])/,
  '## [Unreleased]\n\n'
);
const PACKAGE_JSON = `{
  "name": "qelay-control-panel",
  "version": "1.0.1",
  "license": "MIT",
  "dependencies": { "bunqueue": "2.9.4" }
}
`;

describe('CHANGELOG sections', () => {
  test('finds a version heading with or without a date', () => {
    expect(hasSection(CHANGELOG, '1.0.1')).toBe(true);
    expect(hasSection(CHANGELOG, '1.0.2')).toBe(false);
    expect(hasSection(CHANGELOG, '1.0')).toBe(false);
    expect(hasSection('## [1.0.1]\n', '1.0.1')).toBe(true);
  });

  test('reads the unreleased entries and stops at the next release', () => {
    expect(unreleasedBody(CHANGELOG)).toBe('### Added\n\n- A new thing.\n\n### Fixed\n\n- A bug.');
    expect(unreleasedBody(EMPTY)).toBe('');
    expect(unreleasedBody('# Changelog\n')).toBeNull();
  });

  test('rolls Unreleased into a dated section and a fresh Unreleased', () => {
    const rolled = rollChangelog(CHANGELOG, {
      previous: '1.0.1',
      next: '1.1.0',
      date: '2026-10-09',
    });
    expect(rolled).toContain(
      '## [Unreleased]\n\n## [1.1.0] - 2026-10-09\n\n### Added\n\n- A new thing.'
    );
    expect(unreleasedBody(rolled)).toBe('');
    expect(rolled).toContain(
      `[Unreleased]: ${REPO}/compare/v1.1.0...HEAD\n[1.1.0]: ${REPO}/compare/v1.0.1...v1.1.0\n[1.0.1]:`
    );
    expect(rolled).toContain('Intro text.');
  });

  test('works on a changelog that has no compare links', () => {
    const plain = CHANGELOG.slice(0, CHANGELOG.indexOf('[Unreleased]: '));
    expect(
      rollChangelog(plain, { previous: '1.0.1', next: '1.0.2', date: '2026-10-09' })
    ).toContain('## [1.0.2] - 2026-10-09');
  });

  test('refuses a missing heading or a section that already exists', () => {
    const roll = { previous: '1.0.1', next: '1.1.0', date: '2026-10-09' };
    expect(() => rollChangelog('# Changelog\n', roll)).toThrow('no "## [Unreleased]" heading');
    expect(() => rollChangelog(CHANGELOG, { ...roll, next: '1.0.1' })).toThrow(
      'already has a section for 1.0.1'
    );
  });

  test('renames a rolled section and its links when the version changes', () => {
    const rolled = rollChangelog(CHANGELOG, {
      previous: '1.0.1',
      next: '1.0.2',
      date: '2026-10-08',
    });
    const renamed = retitleSection(rolled, '1.0.2', '1.1.0', '2026-10-09');
    expect(renamed).toContain('## [1.1.0] - 2026-10-09');
    expect(renamed).not.toContain('1.0.2');
    expect(renamed).toContain(`[Unreleased]: ${REPO}/compare/v1.1.0...HEAD`);
    expect(renamed).toContain(`[1.1.0]: ${REPO}/compare/v1.0.1...v1.1.0`);
  });
});

describe('applyRelease', () => {
  const input = {
    packageJson: PACKAGE_JSON,
    changelog: CHANGELOG,
    baseVersion: '1.0.1',
    currentVersion: '1.0.1',
    expected: '1.1.0',
    date: '2026-10-09',
  };

  test('bumps only the version field and rolls the changelog', () => {
    const written = applyRelease(input);
    expect(written.packageJson).toBe(
      PACKAGE_JSON.replace('"version": "1.0.1"', '"version": "1.1.0"')
    );
    expect(hasSection(written.changelog, '1.1.0')).toBe(true);
  });

  test('is a no-op on a changelog that already has the section', () => {
    const rolled = applyRelease(input);
    const again = applyRelease({
      ...input,
      packageJson: rolled.packageJson,
      currentVersion: '1.1.0',
      changelog: rolled.changelog,
    });
    expect(again).toEqual(rolled);
  });

  test('keeps a section the author already wrote by hand and only bumps package.json', () => {
    const handWritten = CHANGELOG.replace(
      '## [1.0.1]',
      '## [1.1.0] - 2026-10-02\n\n- Written early.\n\n## [1.0.1]'
    );
    const written = applyRelease({ ...input, changelog: handWritten });
    expect(written.changelog).toBe(handWritten);
    expect(written.packageJson).toContain('"version": "1.1.0"');
  });

  test('refuses to release with nothing under Unreleased', () => {
    expect(() => applyRelease({ ...input, changelog: EMPTY })).toThrow(
      'Nothing under "## [Unreleased]"'
    );
  });

  test('refuses a changelog without an Unreleased heading', () => {
    expect(() => applyRelease({ ...input, changelog: '# Changelog\n' })).toThrow(
      'no "## [Unreleased]" heading'
    );
  });

  test('renames the section an earlier run made when the level has risen', () => {
    const first = applyRelease({ ...input, expected: '1.0.2' });
    const second = applyRelease({
      ...input,
      packageJson: first.packageJson,
      changelog: first.changelog,
      currentVersion: '1.0.2',
      expected: '1.1.0',
    });
    expect(second.packageJson).toContain('"version": "1.1.0"');
    expect(hasSection(second.changelog, '1.1.0')).toBe(true);
    expect(hasSection(second.changelog, '1.0.2')).toBe(false);
  });

  test('refuses to guess when new entries were added after an earlier run', () => {
    const first = applyRelease({ ...input, expected: '1.0.2' });
    const withNew = first.changelog.replace(
      '## [Unreleased]\n',
      '## [Unreleased]\n\n- Late addition.\n'
    );
    expect(() =>
      applyRelease({
        ...input,
        packageJson: first.packageJson,
        changelog: withNew,
        currentVersion: '1.0.2',
        expected: '1.1.0',
      })
    ).toThrow('from an earlier run');
  });

  test('refuses when package.json has no matching version field', () => {
    expect(() => applyRelease({ ...input, currentVersion: '9.9.9' })).toThrow(
      'no "version": "9.9.9" field'
    );
  });
});
