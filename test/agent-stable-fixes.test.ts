import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { BackupRunnerPort } from '../agent/backup/runner';
import { assertManagedTarget } from '../agent/managedTarget';
import { ManagedProcessStuckError, ProcessManager, type ServerConfig } from '../agent/manager';
import { splitCommandLine } from '../agent/manager/commandLine';
import { createFetchHandler } from '../agent/server';
import { statusWithHealth } from '../agent/server/controlStatus';
import { MANAGED_CONTROL_TARGET } from '../agent/server/controlTarget';
import { errorStatus } from '../agent/server/errors';
import type { WorkflowRuntimePort } from '../agent/workflow/runtime';

const dir = mkdtempSync(join(tmpdir(), 'bq-agent-stable-'));
const cert = join(dir, 'cert.pem');
const key = join(dir, 'key.pem');

beforeAll(async () => {
  const openssl = Bun.spawn(
    [
      'openssl',
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-days',
      '1',
      '-keyout',
      key,
      '-out',
      cert,
      '-subj',
      '/CN=127.0.0.1',
      '-addext',
      'subjectAltName=IP:127.0.0.1',
    ],
    { stdout: 'ignore', stderr: 'ignore' }
  );
  expect(await openssl.exited).toBe(0);
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

function runningManager(config: ServerConfig) {
  const snapshot = {
    status: 'running',
    generation: 1,
    configRevision: 1,
    pid: 1,
    startedAt: 0,
    exitCode: null,
    config,
    runningConfig: config,
  };
  return {
    getStatus: () => snapshot,
    getConfigRevision: () => 1,
    dbStats: async () => null,
  } as unknown as ProcessManager;
}

describe('managed health probe', () => {
  test('uses HTTPS and the private CA once server TLS is configured', async () => {
    const server = Bun.serve({
      port: 0,
      hostname: '127.0.0.1',
      tls: { cert: Bun.file(cert), key: Bun.file(key) },
      fetch: () => Response.json({ ok: true, version: '2.9.4' }),
    });
    try {
      const config: ServerConfig = {
        command: 'bunqueue start',
        httpPort: server.port as number,
        tcpPort: 1,
        dataPath: join(dir, 'unused.db'),
        extraEnv: {
          TLS_CERT_FILE: cert,
          TLS_KEY_FILE: key,
          BUNQUEUE_AGENT_TCP_CA_FILE: cert,
        },
      };
      const status = await statusWithHealth(runningManager(config), MANAGED_CONTROL_TARGET);
      expect(status.healthy).toBe(true);
      expect(status.version).toBe('2.9.4');
    } finally {
      server.stop(true);
    }
  });
});

describe('backup restore', () => {
  test('closes the Workflow Engine before replacing the SQLite file', async () => {
    const dataPath = join(dir, 'restore.db');
    const manager = new ProcessManager();
    manager.setConfig({ command: 'sleep 30', dataPath });
    const database = await manager.dbStats();
    const calls: string[] = [];
    const runtime = {
      close: async () => {
        calls.push('runtime.close');
      },
    } as unknown as WorkflowRuntimePort;
    const runner: BackupRunnerPort = {
      execute: async (_config, operation) => {
        calls.push(`runner.${operation}`);
        return { success: true, message: 'restored' };
      },
      close: async () => undefined,
    };
    const handle = createFetchHandler(manager, { allowedOrigins: [] }, runtime, runner);
    try {
      const target = `http://127.0.0.1:${manager.getConfig().httpPort}`;
      const res = await handle(
        new Request(`http://agent/backup/restore?target=${encodeURIComponent(target)}`, {
          method: 'POST',
          body: JSON.stringify({ key: 'backup.db', database }),
        })
      );
      expect(res.status).toBe(200);
      expect(calls.slice(0, 2)).toEqual(['runtime.close', 'runner.restore']);
    } finally {
      await handle.close();
    }
  });
});

describe('managed target matching', () => {
  test('accepts the bracketed IPv6 loopback form produced by URL', () => {
    const config: ServerConfig = {
      command: 'bunqueue start',
      httpPort: 6790,
      tcpPort: 6789,
      dataPath: join(dir, 'unused.db'),
      extraEnv: {},
    };
    const query = (target: string) => new URLSearchParams({ target });
    expect(() => assertManagedTarget(query('http://[::1]:6790'), config)).not.toThrow();
    expect(() => assertManagedTarget(query('http://[::2]:6790'), config)).toThrow(
      'does not match the agent-managed Bunqueue server'
    );
  });
});

describe('launch command parsing', () => {
  test('keeps quoted paths with spaces together', () => {
    expect(splitCommandLine('"C:\\Program Files\\bun\\bun.exe" run C:\\srv\\main.ts')).toEqual([
      'C:\\Program Files\\bun\\bun.exe',
      'run',
      'C:\\srv\\main.ts',
    ]);
    expect(
      splitCommandLine("bun '/Users/me/Library/Application Support/bq/cli.js'  start ")
    ).toEqual(['bun', '/Users/me/Library/Application Support/bq/cli.js', 'start']);
    expect(splitCommandLine('bunx bunqueue@2.9.4 start')).toEqual([
      'bunx',
      'bunqueue@2.9.4',
      'start',
    ]);
    expect(splitCommandLine('bun --flag="a b"')).toEqual(['bun', '--flag=a b']);
  });

  test('keeps the legacy whitespace split for an unbalanced quote', () => {
    expect(splitCommandLine("/Users/o'brien/bin/bunqueue start")).toEqual([
      "/Users/o'brien/bin/bunqueue",
      'start',
    ]);
  });
});

describe('process-state error statuses', () => {
  test('map conflicts to 409 and a child that survived SIGKILL to 500', () => {
    expect(
      errorStatus(
        new Error('Cannot start while the previous managed process (pid 42) is still alive')
      )
    ).toBe(409);
    expect(errorStatus(new ManagedProcessStuckError('pid 42 did not exit after SIGKILL'))).toBe(
      500
    );
  });
});
