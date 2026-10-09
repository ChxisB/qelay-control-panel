import { afterEach, describe, expect, test } from 'bun:test';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ProcessManager } from '../agent/manager';
import { defaultConfig } from '../agent/manager/config';
import { agentConfigStore, FileConfigStore } from '../agent/manager/configStore';

const directories: string[] = [];
const scratch = () => {
  const directory = mkdtempSync(join(tmpdir(), 'bq-config-test-'));
  directories.push(directory);
  return directory;
};
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe('durable agent configuration', () => {
  test('survives manager recreation without starting the server or reusing revisions', () => {
    const path = join(scratch(), 'private/config.json');
    const manager = new ProcessManager(undefined, new FileConfigStore(path));
    const saved = manager.setConfig({
      command: 'bun custom.ts',
      dataPath: 'other.db',
      extraEnv: { STORAGE: 'sqlite', TOKEN: 'private-value' },
    });
    const restarted = new ProcessManager(undefined, new FileConfigStore(path));
    expect(restarted.getConfig()).toEqual(saved);
    expect(restarted.getStatus()).toMatchObject({
      status: 'stopped',
      pid: null,
      runningConfig: null,
    });
    expect(restarted.getConfigRevision()).not.toBe(manager.getConfigRevision());
    expect(() =>
      restarted.setConfig({ dataPath: 'stale.db' }, manager.getConfigRevision())
    ).toThrow('Configuration changed');
    saved.extraEnv.TOKEN = 'changed-copy';
    expect(restarted.getConfig().extraEnv.TOKEN).toBe('private-value');
    if (process.platform !== 'win32') {
      expect(statSync(path).mode & 0o777).toBe(0o600);
      expect(statSync(join(path, '..')).mode & 0o777).toBe(0o700);
    }
    expect(readdirSync(join(path, '..'))).toEqual(['config.json']);
  });

  test('a failed save leaves both in-memory configuration and revision unchanged', () => {
    const directory = scratch();
    const path = join(directory, 'config.json');
    const manager = new ProcessManager(undefined, new FileConfigStore(path));
    const before = manager.getConfig();
    const revision = manager.getConfigRevision();
    mkdirSync(path); // Atomically replacing a directory must fail on every OS.
    expect(() => manager.setConfig({ dataPath: 'new.db' })).toThrow('Cannot persist');
    expect(manager.getConfig()).toEqual(before);
    expect(manager.getConfigRevision()).toBe(revision);
    expect(readdirSync(directory)).toEqual(['config.json']);
  });

  test('invalid or oversized input never replaces the last valid snapshot', () => {
    const path = join(scratch(), 'config.json');
    const manager = new ProcessManager(undefined, new FileConfigStore(path));
    manager.setConfig({ dataPath: 'persisted.db' });
    const original = readFileSync(path, 'utf8');
    expect(() => manager.setConfig({ httpPort: -1 })).toThrow();
    expect(() => manager.setConfig({ extraEnv: { LARGE: 'x'.repeat(1024 * 1024) } })).toThrow(
      'exceeds 1 MiB'
    );
    expect(readFileSync(path, 'utf8')).toBe(original);
  });

  test('corrupt, incomplete and unsupported snapshots fail startup without revealing content', () => {
    const path = join(scratch(), 'config.json');
    for (const content of [
      'secret-not-json',
      'null',
      '{"version":2}',
      '{"version":1,"config":{}}',
      'x'.repeat(1024 * 1024 + 1),
    ]) {
      writeFileSync(path, content);
      expect(() => new FileConfigStore(path).load(defaultConfig())).toThrow(
        'Saved agent configuration is invalid'
      );
    }
  });

  test('load errors fail closed; missing files use independent copies of defaults', () => {
    const path = join(scratch(), 'config.json');
    const fallback = defaultConfig();
    const loaded = new FileConfigStore(path).load(fallback);
    loaded.extraEnv.TEST = 'value';
    expect(fallback.extraEnv.TEST).toBeUndefined();
    if (process.platform !== 'win32') {
      symlinkSync(path, path);
      expect(() => new FileConfigStore(path).load(fallback)).toThrow('Cannot read');
    }
    expect(agentConfigStore({ AGENT_CONFIG_PATH: path }).path).toBe(path);
    expect(agentConfigStore({}).path).toBe(resolve('.qelay-control-panel/config.json'));
    expect(agentConfigStore({}).legacyPath).toBe(resolve('.bunqueue-dashboard/config.json'));
    // An explicit path is never redirected through the legacy fallback.
    expect(agentConfigStore({ AGENT_CONFIG_PATH: path }).legacyPath).toBeUndefined();
  });
});

describe('pre-rebrand saved configuration', () => {
  const save = (path: string, extra: Record<string, string>) =>
    new FileConfigStore(path).save({ ...defaultConfig(), extraEnv: extra });

  test('is copied to the new path once, and the old file is left untouched', () => {
    const directory = scratch();
    const legacy = join(directory, 'old/config.json');
    const path = join(directory, 'new/config.json');
    save(legacy, { KEEP: 'me' });
    const before = readFileSync(legacy, 'utf8');

    const loaded = new FileConfigStore(path, legacy).load(defaultConfig());
    expect(loaded.extraEnv).toEqual({ KEEP: 'me' });
    expect(readFileSync(legacy, 'utf8')).toBe(before);
    expect(readFileSync(path, 'utf8')).toBe(before);
    if (process.platform !== 'win32') {
      expect(statSync(path).mode & 0o777).toBe(0o600);
      expect(statSync(join(path, '..')).mode & 0o777).toBe(0o700);
    }
  });

  test('the new file wins and later edits never reach the old file', () => {
    const directory = scratch();
    const legacy = join(directory, 'old/config.json');
    const path = join(directory, 'new/config.json');
    save(legacy, { WHICH: 'old' });
    save(path, { WHICH: 'new' });
    const before = readFileSync(legacy, 'utf8');

    const store = new FileConfigStore(path, legacy);
    expect(store.load(defaultConfig()).extraEnv).toEqual({ WHICH: 'new' });
    store.save({ ...defaultConfig(), extraEnv: { WHICH: 'edited' } });
    expect(readFileSync(legacy, 'utf8')).toBe(before);
  });

  test('neither file present falls back to the defaults and writes nothing', () => {
    const directory = scratch();
    const path = join(directory, 'new/config.json');
    const loaded = new FileConfigStore(path, join(directory, 'old/config.json')).load(
      defaultConfig()
    );
    expect(loaded).toEqual(defaultConfig());
    expect(readdirSync(directory)).toEqual([]);
  });

  test('a damaged old file fails closed instead of being replaced by defaults', () => {
    const directory = scratch();
    const legacy = join(directory, 'old/config.json');
    mkdirSync(join(directory, 'old'));
    writeFileSync(legacy, '{not json');
    expect(() =>
      new FileConfigStore(join(directory, 'new/config.json'), legacy).load(defaultConfig())
    ).toThrow('invalid');
  });

  test('a failed copy still applies the old settings for this run', () => {
    if (process.platform === 'win32' || process.getuid?.() === 0) return;
    const directory = scratch();
    const legacy = join(directory, 'old/config.json');
    save(legacy, { KEEP: 'me' });
    // A read-only target directory makes the copy impossible.
    const target = join(directory, 'new');
    mkdirSync(target, { mode: 0o500 });
    try {
      const loaded = new FileConfigStore(join(target, 'config.json'), legacy).load(defaultConfig());
      expect(loaded.extraEnv).toEqual({ KEEP: 'me' });
      expect(readdirSync(target)).toEqual([]);
    } finally {
      chmodSync(target, 0o700);
    }
  });
});
