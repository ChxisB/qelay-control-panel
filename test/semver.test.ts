import { describe, expect, test } from 'bun:test';
import { bumpSemver, compareSemver, formatSemver, parseSemver } from '../scripts/semver';

function version(text: string) {
  const parsed = parseSemver(text);
  if (!parsed) throw new Error(`${text} should parse`);
  return parsed;
}

describe('SemVer 2.0.0 parsing (semver.org)', () => {
  test.each([
    '0.0.4',
    '1.2.3',
    '10.20.30',
    '1.1.2-prerelease+meta',
    '1.1.2+meta',
    '1.1.2+meta-valid',
    '1.0.0-alpha',
    '1.0.0-alpha.beta',
    '1.0.0-alpha.1',
    '1.0.0-alpha0.valid',
    '1.0.0-alpha.0valid',
    '1.0.0-alpha-a.b-c-somethinglong+build.1-aef.1-its-okay',
    '1.0.0-rc.1+build.1',
    '2.0.0-rc.1+build.123',
    '10.2.3-DEV-SNAPSHOT',
    '1.2.3----RC-SNAPSHOT.12.9.1--.12+788',
    '1.0.0+0.build.1-rc.10000aaa-kk-0.1',
    '99999999999999999999999.999999999999999999.99999999999999999',
  ])('accepts %s and formats it back unchanged', (text) => {
    expect(formatSemver(version(text))).toBe(text);
  });

  test.each([
    '1',
    '1.2',
    '1.2.3.4',
    '01.1.1',
    '1.01.1',
    '1.1.01',
    'v1.2.3',
    ' 1.2.3',
    '1.2.3-',
    '1.2.3-0123',
    '1.2.3-0123.0123',
    '1.1.2+.123',
    '+invalid',
    '-invalid',
    '-1.0.3-gamma+b7718',
    '1.0.0-alpha_beta',
    '1.0.0-alpha..1',
    '9.8.7+meta+meta',
    '9.8.7-whatever+meta+meta',
  ])('rejects %s', (text) => {
    expect(parseSemver(text)).toBeNull();
  });

  test('splits the numeric core, pre-release and build identifiers', () => {
    expect(version('1.2.3-alpha.1+build.5')).toEqual({
      major: 1n,
      minor: 2n,
      patch: 3n,
      prerelease: ['alpha', '1'],
      build: ['build', '5'],
    });
  });
});

describe('SemVer precedence (spec item 11)', () => {
  const ascending = [
    '1.0.0-alpha',
    '1.0.0-alpha.1',
    '1.0.0-alpha.beta',
    '1.0.0-beta',
    '1.0.0-beta.2',
    '1.0.0-beta.11',
    '1.0.0-rc.1',
    '1.0.0',
    '2.0.0',
    '2.1.0',
    '2.1.1',
  ];

  test('orders the spec example chain', () => {
    for (let index = 1; index < ascending.length; index += 1) {
      const lower = version(ascending[index - 1]);
      const higher = version(ascending[index]);
      expect([ascending[index - 1], compareSemver(lower, higher)]).toEqual([
        ascending[index - 1],
        -1,
      ]);
      expect(compareSemver(higher, lower)).toBe(1);
    }
  });

  test('compares numeric fields as numbers, not text', () => {
    expect(compareSemver(version('1.10.0'), version('1.9.0'))).toBe(1);
    expect(compareSemver(version('1.0.0-rc.10'), version('1.0.0-rc.9'))).toBe(1);
  });

  test('ignores build metadata', () => {
    expect(compareSemver(version('1.0.0+a'), version('1.0.0+b'))).toBe(0);
    expect(compareSemver(version('1.0.0'), version('1.0.0+build.9'))).toBe(0);
  });

  test('stays exact beyond the safe-integer range', () => {
    const big = version('1.0.9007199254740993');
    expect(compareSemver(big, version('1.0.9007199254740992'))).toBe(1);
    expect(formatSemver(bumpSemver(big, 'patch'))).toBe('1.0.9007199254740994');
  });
});

describe('bumping', () => {
  test.each([
    ['1.0.1', 'patch', '1.0.2'],
    ['1.0.1', 'minor', '1.1.0'],
    ['1.0.1', 'major', '2.0.0'],
    ['1.4.9', 'minor', '1.5.0'],
    ['1.4.9', 'major', '2.0.0'],
    ['0.9.9', 'patch', '0.9.10'],
  ] as const)('%s + %s = %s', (from, level, to) => {
    expect(formatSemver(bumpSemver(version(from), level))).toBe(to);
  });

  test('drops pre-release and build parts and never mutates its input', () => {
    const start = version('1.2.3-rc.1+build.7');
    expect(formatSemver(bumpSemver(start, 'patch'))).toBe('1.2.4');
    expect(formatSemver(start)).toBe('1.2.3-rc.1+build.7');
  });
});
