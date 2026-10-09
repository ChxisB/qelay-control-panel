// Keep a Changelog edits for a release: turn `## [Unreleased]` into `## [x.y.z] - date`,
// open a fresh `[Unreleased]` above it and keep the compare links at the bottom in step.

const UNRELEASED_HEADING = /^## \[Unreleased\][^\n]*\n/m;
const UNRELEASED_LINK = /^\[Unreleased\]: (.+)\/compare\/v[^\s/]+\.\.\.HEAD$/m;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sectionHeading(version: string): RegExp {
  return new RegExp(`^## \\[${escapeRegExp(version)}\\][^\\n]*$`, 'm');
}

export function hasSection(changelog: string, version: string): boolean {
  return sectionHeading(version).test(changelog);
}

/** The entries under `[Unreleased]`, trimmed; null when the heading is missing. */
export function unreleasedBody(changelog: string): string | null {
  const heading = UNRELEASED_HEADING.exec(changelog);
  if (!heading) return null;
  const rest = changelog.slice(heading.index + heading[0].length);
  const end = rest.search(/^## /m);
  return (end === -1 ? rest : rest.slice(0, end)).trim();
}

export interface Roll {
  previous: string;
  next: string;
  date: string;
}

/** Moves the `[Unreleased]` entries under a new dated `[next]` section. */
export function rollChangelog(changelog: string, { previous, next, date }: Roll): string {
  if (!UNRELEASED_HEADING.test(changelog)) throw new Error('CHANGELOG.md has no "## [Unreleased]" heading');
  if (hasSection(changelog, next)) throw new Error(`CHANGELOG.md already has a section for ${next}`);
  return changelog
    .replace(UNRELEASED_HEADING, () => `## [Unreleased]\n\n## [${next}] - ${date}\n`)
    .replace(
      UNRELEASED_LINK,
      (_line, repository: string) =>
        `[Unreleased]: ${repository}/compare/v${next}...HEAD\n` +
        `[${next}]: ${repository}/compare/v${previous}...v${next}`
    );
}

/** Renames a section a previous run created (the bump level rose since) and its links. */
export function retitleSection(changelog: string, from: string, to: string, date: string): string {
  const source = escapeRegExp(from);
  return changelog
    .replace(sectionHeading(from), () => `## [${to}] - ${date}`)
    .replace(
      new RegExp(`^(\\[Unreleased\\]: .+/compare/)v${source}(\\.\\.\\.HEAD)$`, 'm'),
      (_line, head: string, tail: string) => `${head}v${to}${tail}`
    )
    .replace(
      new RegExp(`^\\[${source}\\]: (.+/compare/v[^\\s/]+\\.\\.\\.)v${source}$`, 'm'),
      (_line, head: string) => `[${to}]: ${head}v${to}`
    );
}
