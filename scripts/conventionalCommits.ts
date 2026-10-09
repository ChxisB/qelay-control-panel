// Conventional Commits 1.0.0 (https://www.conventionalcommits.org) mapped onto the SemVer
// level each commit asks for. Pure functions: the git plumbing lives in release-version.ts.

import type { BumpLevel } from './semver';

export type ReleaseLevel = BumpLevel | 'none';

// What each type asks for when it is not breaking. Types that change nothing a user installs
// (docs, tests, CI, refactors) ask for no release by themselves.
const TYPE_LEVEL: Record<string, ReleaseLevel> = {
  feat: 'minor',
  fix: 'patch',
  perf: 'patch',
  revert: 'patch',
  docs: 'none',
  style: 'none',
  refactor: 'none',
  test: 'none',
  build: 'none',
  ci: 'none',
  chore: 'none',
};

export interface ParsedCommit {
  type: string;
  scope: string | null;
  breaking: boolean;
  description: string;
  level: ReleaseLevel;
}

const HEADER = /^([a-z]+)(?:\(([^()\r\n]+)\))?(!)?: (\S.*)$/;
// The subject GitHub's Revert button writes, which is not itself a Conventional Commit.
const GITHUB_REVERT = /^Revert "(.+)"$/;
const BREAKING_FOOTER = /^BREAKING[ -]CHANGE(?:: | #)/m;
const RANK: Record<ReleaseLevel, number> = { none: 0, patch: 1, minor: 2, major: 3 };

export function subjectOf(message: string): string {
  return message.split(/\r?\n/, 1)[0].trim();
}

/** Returns null when the message is not a Conventional Commit of a known type. */
export function parseCommit(message: string): ParsedCommit | null {
  const header = subjectOf(message);
  const breakingFooter = BREAKING_FOOTER.test(message);
  const revert = GITHUB_REVERT.exec(header);
  if (revert) {
    return {
      type: 'revert',
      scope: null,
      breaking: breakingFooter,
      description: revert[1],
      level: breakingFooter ? 'major' : 'patch',
    };
  }
  const match = HEADER.exec(header);
  if (!match || !Object.hasOwn(TYPE_LEVEL, match[1])) return null;
  const breaking = match[3] === '!' || breakingFooter;
  return {
    type: match[1],
    scope: match[2] ?? null,
    breaking,
    description: match[4],
    level: breaking ? 'major' : TYPE_LEVEL[match[1]],
  };
}

/** The highest level any of the commits asks for. */
export function highestLevel(levels: ReleaseLevel[]): ReleaseLevel {
  return levels.reduce<ReleaseLevel>((top, next) => (RANK[next] > RANK[top] ? next : top), 'none');
}

/**
 * A `Release-As: x.y.z` footer pins the version instead of deriving it. The newest commit
 * that carries one wins. Messages are newest first.
 */
export function releaseAsOf(messages: string[]): string | null {
  for (const message of messages) {
    const match = /^Release-As:[ \t]*(\S+)[ \t]*$/im.exec(message);
    if (match) return match[1];
  }
  return null;
}
