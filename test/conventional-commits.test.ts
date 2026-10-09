import { describe, expect, test } from 'bun:test';
import { highestLevel, parseCommit, releaseAsOf, subjectOf } from '../scripts/conventionalCommits';

describe('Conventional Commits → SemVer level', () => {
  test.each([
    ['feat: add a queue filter', 'minor'],
    ['feat(jobs): add a queue filter', 'minor'],
    ['fix: stop the table flashing', 'patch'],
    ['perf(ui): memoize rows', 'patch'],
    ['revert: undo the flaky retry', 'patch'],
    ['docs: explain the agent', 'none'],
    ['style: format', 'none'],
    ['refactor(agent): split the manager', 'none'],
    ['test: cover the proxy', 'none'],
    ['build: cross-build the image', 'none'],
    ['ci: run the gate in parallel', 'none'],
    ['chore(deps): bump react', 'none'],
  ] as const)('%s asks for %s', (message, level) => {
    expect(parseCommit(message)?.level).toBe(level);
  });

  test('a ! after the type or scope makes any type a major change', () => {
    expect(parseCommit('feat!: drop the v1 routes')?.level).toBe('major');
    expect(parseCommit('fix(agent)!: refuse to start without a token')?.level).toBe('major');
    expect(parseCommit('chore!: require Bun 2')).toMatchObject({ breaking: true, level: 'major' });
  });

  test('a BREAKING CHANGE footer makes any type a major change', () => {
    const footer =
      'refactor: rename the config dir\n\nMoves it.\n\nBREAKING CHANGE: the old dir is ignored';
    expect(parseCommit(footer)).toMatchObject({ breaking: true, level: 'major' });
    expect(parseCommit('fix: x\n\nBREAKING-CHANGE: y')?.level).toBe('major');
    expect(parseCommit('fix: x\n\nBREAKING CHANGE #12')?.level).toBe('major');
  });

  test('only a footer line counts, not the words inside a sentence', () => {
    expect(parseCommit('fix: x\n\nThis is not a BREAKING CHANGE: just prose')?.level).toBe('patch');
  });

  test('reads type, scope and description', () => {
    expect(parseCommit('feat(jobs): add a filter')).toEqual({
      type: 'feat',
      scope: 'jobs',
      breaking: false,
      description: 'add a filter',
      level: 'minor',
    });
    expect(parseCommit('fix: no scope')?.scope).toBeNull();
  });

  test('treats the subject GitHub writes for a revert as a patch', () => {
    expect(parseCommit('Revert "feat: add a queue filter"')).toMatchObject({
      type: 'revert',
      level: 'patch',
    });
  });

  test.each([
    'Add a queue filter',
    'Merge pull request #45 from x/y',
    'Release 0.0.43: upgrade Bunqueue',
    'feet: typo in the type',
    'Feat: capitalised',
    'feat:no space',
    'feat: ',
    'feat(): empty scope',
    'constructor: not a type',
    '',
  ])('rejects %p', (message) => {
    expect(parseCommit(message)).toBeNull();
  });

  test('only the subject line is parsed as the header', () => {
    expect(parseCommit('Add things\n\nfeat: hidden in the body')).toBeNull();
    expect(subjectOf('feat: a\r\n\r\nbody')).toBe('feat: a');
  });
});

describe('highestLevel', () => {
  test('picks the largest request and defaults to none', () => {
    expect(highestLevel([])).toBe('none');
    expect(highestLevel(['none', 'patch'])).toBe('patch');
    expect(highestLevel(['patch', 'minor', 'none'])).toBe('minor');
    expect(highestLevel(['minor', 'major', 'patch'])).toBe('major');
  });
});

describe('Release-As footer', () => {
  test('returns null without one', () => {
    expect(releaseAsOf(['feat: a', 'fix: b'])).toBeNull();
  });

  test('the newest commit carrying one wins', () => {
    const messages = ['fix: b', 'feat: a\n\nRelease-As: 2.0.0', 'chore: c\n\nRelease-As: 1.5.0'];
    expect(releaseAsOf(messages)).toBe('2.0.0');
  });

  test('is read from its own footer line only', () => {
    expect(releaseAsOf(['fix: a\n\nrelease-as: 1.2.3-rc.1  '])).toBe('1.2.3-rc.1');
    expect(releaseAsOf(['fix: mentions Release-As: 3.0.0 mid-sentence'])).toBeNull();
  });
});
