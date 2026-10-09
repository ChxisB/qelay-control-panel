import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

const pkg = JSON.parse(read('package.json')) as { name: string };
const validation = read('.github/workflows/validation.yml');
const release = read('.github/workflows/release.yml');

// The release job renames each tested native binary and checksums it by name. One
// misspelling between the build, the rename and the globs is silent until a real release
// (a doubled glob match once broke v0.0.22), so the names are pinned to package.json here.
const PREFIX = `${pkg.name}-`;
const NATIVE = `${PREFIX}\${{ matrix.platform }}\${{ matrix.suffix }}`;

describe('release workflow naming', () => {
  test('the native job builds, validates and uploads the same binary name', () => {
    expect(validation.split(`--outfile ${NATIVE}`)).toHaveLength(2);
    expect(validation.split(`validate-standalone-runtime.ts ./${NATIVE}`)).toHaveLength(2);
    expect(validation.split(`path: ${NATIVE}`)).toHaveLength(2);
  });

  test('the release job strips the native prefix and re-prefixes with the tag', () => {
    expect(release).toContain(`suffix="\${suffix#${PREFIX}}"`);
    expect(release).toContain(`mv "$file" "${PREFIX}\${RELEASE_TAG}-\${suffix}"`);
  });

  test('checksums and uploads stay anchored on the exact tag', () => {
    expect(release).toContain(
      `sha256sum "${PREFIX}\${RELEASE_TAG}.zip" "${PREFIX}\${RELEASE_TAG}"-* > SHA256SUMS`
    );
    const tagged = `${PREFIX}\${{ steps.ver.outputs.tag }}`;
    expect(release).toContain(`(cd dist && zip -qr "../${tagged}.zip" .)`);
    // Attestation subjects and the published files list the zip and the per-platform binaries.
    expect(release.split(`${tagged}.zip\n`).length - 1).toBe(2);
    expect(release.split(`${tagged}-*\n`).length - 1).toBe(2);
  });

  test('no workflow or issue template still names the pre-rebrand package or repo', () => {
    for (const file of [
      '.github/workflows/release.yml',
      '.github/workflows/validation.yml',
      '.github/workflows/docker.yml',
      '.github/workflows/pages.yml',
      '.github/ISSUE_TEMPLATE/config.yml',
      '.github/ISSUE_TEMPLATE/bug_report.yml',
      'Dockerfile',
      'docker/Caddyfile',
    ]) {
      expect(read(file).toLowerCase()).not.toMatch(/bunqueue.?dashboard|egeominotti/);
    }
  });

  test('the npm job checks the registry for this package, not the upstream one', () => {
    expect(release).toContain(`bun info "${pkg.name}@\${VER}" version`);
    expect(release).toContain(`\`bunx ${pkg.name}\``);
  });
});
