// Semantic Versioning 2.0.0 (https://semver.org): parsing, precedence (spec item 11) and bumping.

export type BumpLevel = 'major' | 'minor' | 'patch';

// The spec puts no upper bound on the numeric fields, so they are bigints.
export interface SemVer {
  major: bigint;
  minor: bigint;
  patch: bigint;
  prerelease: string[];
  build: string[];
}

// The regular expression published on semver.org, verbatim.
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

export function parseSemver(input: string): SemVer | null {
  const match = SEMVER.exec(input);
  if (!match) return null;
  return {
    major: BigInt(match[1]),
    minor: BigInt(match[2]),
    patch: BigInt(match[3]),
    prerelease: match[4]?.split('.') ?? [],
    build: match[5]?.split('.') ?? [],
  };
}

export function formatSemver(version: SemVer): string {
  const core = `${version.major}.${version.minor}.${version.patch}`;
  const prerelease = version.prerelease.length > 0 ? `-${version.prerelease.join('.')}` : '';
  const build = version.build.length > 0 ? `+${version.build.join('.')}` : '';
  return core + prerelease + build;
}

type Order = -1 | 0 | 1;

function order(difference: bigint | number): Order {
  return difference < 0 ? -1 : difference > 0 ? 1 : 0;
}

function compareText(a: string, b: string): Order {
  return a < b ? -1 : a > b ? 1 : 0; // ASCII order: identifiers only hold [0-9A-Za-z-]
}

function compareIdentifier(a: string, b: string): Order {
  const numericA = /^\d+$/.test(a);
  const numericB = /^\d+$/.test(b);
  // Numeric identifiers never carry leading zeros, so length then text is numeric order
  // without risking precision loss on very long numbers.
  if (numericA && numericB) return order(a.length - b.length) || compareText(a, b);
  if (numericA) return -1; // numeric identifiers rank below alphanumeric ones
  if (numericB) return 1;
  return compareText(a, b);
}

function comparePrerelease(a: string[], b: string[]): Order {
  if (a.length === 0 && b.length === 0) return 0;
  if (a.length === 0) return 1; // a normal version outranks any of its pre-releases
  if (b.length === 0) return -1;
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    const result = compareIdentifier(a[index], b[index]);
    if (result !== 0) return result;
  }
  return order(a.length - b.length); // a larger set of fields outranks a smaller one
}

/** Precedence per semver.org item 11. Build metadata is ignored. */
export function compareSemver(a: SemVer, b: SemVer): Order {
  return (
    order(a.major - b.major) ||
    order(a.minor - b.minor) ||
    order(a.patch - b.patch) ||
    comparePrerelease(a.prerelease, b.prerelease)
  );
}

/** The next normal version. Resets lower fields and drops pre-release and build parts. */
export function bumpSemver(version: SemVer, level: BumpLevel): SemVer {
  const { major, minor, patch } = version;
  const next = { prerelease: [], build: [] };
  if (level === 'major') return { ...next, major: major + 1n, minor: 0n, patch: 0n };
  if (level === 'minor') return { ...next, major, minor: minor + 1n, patch: 0n };
  return { ...next, major, minor, patch: patch + 1n };
}
