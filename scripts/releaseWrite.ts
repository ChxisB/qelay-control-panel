// Writes a planned release into package.json and CHANGELOG.md text. No I/O.

import { hasSection, retitleSection, rollChangelog, unreleasedBody } from './changelogRelease';

export interface WriteInput {
  packageJson: string;
  changelog: string;
  baseVersion: string;
  currentVersion: string;
  expected: string;
  date: string;
}

export interface Written {
  packageJson: string;
  changelog: string;
}

function setVersion(packageJson: string, current: string, expected: string): string {
  // Edit the text rather than re-serializing, so the file's formatting is left alone.
  const field = new RegExp(`("version":\\s*")${current.replace(/[.+]/g, '\\$&')}(")`);
  if (!field.test(packageJson)) throw new Error(`package.json has no "version": "${current}" field`);
  return packageJson.replace(field, (_match, head: string, tail: string) => `${head}${expected}${tail}`);
}

function writeChangelog({ changelog, baseVersion, currentVersion, expected, date }: WriteInput): string {
  if (hasSection(changelog, expected)) return changelog;
  const entries = unreleasedBody(changelog);
  if (entries === null) throw new Error('CHANGELOG.md has no "## [Unreleased]" heading');
  // A section left by an earlier run, from before the bump level rose: rename it.
  if (currentVersion !== baseVersion && hasSection(changelog, currentVersion)) {
    if (entries !== '') {
      throw new Error(
        `CHANGELOG.md has a [${currentVersion}] section from an earlier run and new entries under ` +
          `[Unreleased]. Move those entries into [${currentVersion}] and run this again.`
      );
    }
    return retitleSection(changelog, currentVersion, expected, date);
  }
  if (entries === '') {
    throw new Error(
      'Nothing under "## [Unreleased]" in CHANGELOG.md. Describe the change first: the release notes are taken from it.'
    );
  }
  return rollChangelog(changelog, { previous: baseVersion, next: expected, date });
}

export function applyRelease(input: WriteInput): Written {
  return {
    packageJson: setVersion(input.packageJson, input.currentVersion, input.expected),
    changelog: writeChangelog(input),
  };
}
