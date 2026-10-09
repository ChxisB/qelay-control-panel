import { closeSync, constants, fstatSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { copyConfig, validateServerConfig } from './config';
import { LEGACY_CONFIG_PATH } from './legacyConfig';
import type { ServerConfig } from './types';

export interface ConfigStore {
  load(fallback: ServerConfig): ServerConfig;
  save(config: ServerConfig): void;
}

const MAX_CONFIG_BYTES = 1024 * 1024;

/** Default saved-settings location, relative to the launch directory. */
export const DEFAULT_CONFIG_PATH = '.qelay-control-panel/config.json';

/**
 * Read one saved snapshot. `null` means the file does not exist; anything else
 * that is wrong with it throws, so a damaged config fails closed instead of being
 * silently replaced by defaults.
 */
function readConfigFile(path: string): ServerConfig | null {
  let descriptor: number;
  try {
    descriptor = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw new Error('Cannot read saved agent configuration');
  }
  try {
    if (fstatSync(descriptor).size > MAX_CONFIG_BYTES) throw new Error('oversize');
    const raw = readFileSync(descriptor);
    if (raw.byteLength > MAX_CONFIG_BYTES) throw new Error('oversize');
    const saved = JSON.parse(raw.toString()) as { version?: unknown; config?: unknown };
    if (saved?.version !== 1) throw new Error('unsupported format');
    return copyConfig(validateServerConfig(saved.config));
  } catch {
    throw new Error('Saved agent configuration is invalid; repair or remove AGENT_CONFIG_PATH before restarting');
  } finally {
    closeSync(descriptor);
  }
}

/**
 * Private atomic snapshots. Errors never include configuration secrets.
 *
 * `legacyPath` is the pre-rebrand location. It is read only while `path` does not
 * exist, and it is copied, never moved: the old file is left exactly as it was.
 */
export class FileConfigStore implements ConfigStore {
  constructor(
    readonly path: string,
    readonly legacyPath?: string
  ) {}

  load(fallback: ServerConfig): ServerConfig {
    const saved = readConfigFile(this.path);
    if (saved) return saved;
    const legacy = this.legacyPath ? readConfigFile(this.legacyPath) : null;
    if (!legacy) return copyConfig(fallback);
    try {
      this.save(legacy);
    } catch {
      // The copy is best effort; the adopted settings still apply this run.
    }
    return legacy;
  }

  save(config: ServerConfig): void {
    const content = JSON.stringify({ version: 1, config: validateServerConfig(config) }) + '\n';
    if (Buffer.byteLength(content) > MAX_CONFIG_BYTES) throw new Error('Agent configuration exceeds 1 MiB');
    const directory = dirname(this.path);
    const temporary = `${this.path}.${process.pid}.${crypto.randomUUID()}.tmp`;
    let descriptor: number | undefined;
    try {
      mkdirSync(directory, { recursive: true, mode: 0o700 });
      descriptor = openSync(temporary, 'wx', 0o600);
      writeFileSync(descriptor, content);
      fsyncSync(descriptor);
      closeSync(descriptor);
      descriptor = undefined;
      renameSync(temporary, this.path);
    } catch {
      throw new Error('Cannot persist agent configuration; the change was not applied');
    } finally {
      if (descriptor !== undefined) closeSync(descriptor);
      rmSync(temporary, { force: true });
    }
  }
}

/** Paths resolve against the launch directory, just like the database path. Use one path per agent. */
export function agentConfigStore(env: NodeJS.ProcessEnv = process.env): FileConfigStore {
  if (env.AGENT_CONFIG_PATH) return new FileConfigStore(resolve(env.AGENT_CONFIG_PATH));
  return new FileConfigStore(resolve(DEFAULT_CONFIG_PATH), resolve(LEGACY_CONFIG_PATH));
}
