// Decides which SemVer version a branch should carry, from the Conventional Commits it adds
// on top of its base. No I/O: release-version.ts feeds it git and file contents.

import { hasSection } from './changelogRelease';
import { highestLevel, parseCommit, releaseAsOf, subjectOf } from './conventionalCommits';
import { bumpSemver, compareSemver, formatSemver, parseSemver } from './semver';
import type { ReleaseLevel } from './conventionalCommits';

export interface CommitInput {
  sha: string;
  message: string;
}

export interface PlanInput {
  /** `version` in package.json at the base ref: the last version main carries. */
  baseVersion: string;
  /** `version` in package.json in the working tree. */
  currentVersion: string;
  /** Non-merge commits on top of the base, newest first. */
  commits: CommitInput[];
  changelog: string;
  tagExists: (version: string) => boolean;
}

export interface PlannedCommit {
  sha: string;
  subject: string;
  /** null when the message is not a Conventional Commit. */
  level: ReleaseLevel | null;
}

export interface Plan {
  level: ReleaseLevel;
  releaseAs: string | null;
  /** The version package.json must carry. */
  expected: string;
  /** Whether this branch publishes a new release when it lands. */
  releasing: boolean;
  commits: PlannedCommit[];
  /** Problems no file edit can fix. */
  blocking: string[];
  /** package.json or CHANGELOG.md disagree with `expected`; writing the release fixes these. */
  drift: string[];
}

function short(sha: string): string {
  return sha.slice(0, 7);
}

function expectedVersion(input: PlanInput, level: ReleaseLevel, releaseAs: string | null) {
  const blocking: string[] = [];
  const base = parseSemver(input.baseVersion);
  if (!base) {
    blocking.push(`The base version "${input.baseVersion}" is not valid SemVer (https://semver.org).`);
    return { expected: input.baseVersion, blocking };
  }
  if (releaseAs !== null) {
    const pinned = parseSemver(releaseAs);
    if (!pinned || pinned.build.length > 0) {
      blocking.push(
        `Release-As "${releaseAs}" is not a valid SemVer version (build metadata cannot go in a tag).`
      );
    } else if (compareSemver(pinned, base) < 0) {
      blocking.push(`Release-As ${releaseAs} is lower than the base version ${input.baseVersion}.`);
    } else {
      return { expected: releaseAs, blocking };
    }
  } else if (level !== 'none') {
    if (base.prerelease.length > 0) {
      blocking.push(
        `The base version ${input.baseVersion} is a pre-release; add a "Release-As: x.y.z" footer to choose the next version.`
      );
    } else {
      return { expected: formatSemver(bumpSemver(base, level)), blocking };
    }
  }
  return { expected: input.baseVersion, blocking };
}

export function planRelease(input: PlanInput): Plan {
  const commits: PlannedCommit[] = input.commits.map(({ sha, message }) => ({
    sha,
    subject: subjectOf(message),
    level: parseCommit(message)?.level ?? null,
  }));
  const level = highestLevel(commits.flatMap((commit) => (commit.level ? [commit.level] : [])));
  const releaseAs = releaseAsOf(input.commits.map((commit) => commit.message));
  const { expected, blocking } = expectedVersion(input, level, releaseAs);
  const releasing = releaseAs !== null || level !== 'none';

  for (const commit of commits) {
    if (commit.level === null) {
      blocking.push(
        `${short(commit.sha)} "${commit.subject}" is not a Conventional Commit: use "type(scope): description" ` +
          'with a type of feat, fix, perf, revert, docs, style, refactor, test, build, ci or chore.'
      );
    }
  }
  if (!parseSemver(input.currentVersion)) {
    blocking.push(`package.json version "${input.currentVersion}" is not valid SemVer (https://semver.org).`);
  }
  if (releasing && input.tagExists(expected)) {
    blocking.push(
      `v${expected} is already tagged, and a released version must never change. ` +
        'Update the branch from main, or choose a higher version with a "Release-As: x.y.z" footer.'
    );
  }

  const drift: string[] = [];
  if (input.currentVersion !== expected) {
    drift.push(
      releasing
        ? `package.json is ${input.currentVersion} but these commits release ${expected}.`
        : `package.json is ${input.currentVersion} but no commit here is releasable, so it must stay ${expected}.`
    );
  }
  if (releasing && expected !== input.baseVersion && !hasSection(input.changelog, expected)) {
    drift.push(`CHANGELOG.md has no "## [${expected}]" section.`);
  }
  return { level, releaseAs, expected, releasing, commits, blocking, drift };
}
