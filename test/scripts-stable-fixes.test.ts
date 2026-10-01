import { afterEach, describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { AGENT_SHUTDOWN_GRACE_MS } from '../agent/shutdown';
import { FORCE_KILL_AFTER_MS, serviceExitCode } from '../scripts/dev';
import { createServeHandler, upstreamHeaders } from '../scripts/serveHandler';

const servers: Array<ReturnType<typeof Bun.serve>> = [];

afterEach(() => {
  for (const server of servers.splice(0)) server.stop(true);
});

describe('/api proxy upstream headers', () => {
  it('derives Host from BUNQUEUE_URL and keeps cookies on the dashboard origin', async () => {
    const upstream = Bun.serve({
      port: 0,
      hostname: '127.0.0.1',
      fetch: (req) =>
        Response.json({
          host: req.headers.get('host'),
          cookie: req.headers.get('cookie'),
          authorization: req.headers.get('authorization'),
          upgrade: req.headers.get('upgrade'),
        }),
    });
    servers.push(upstream);
    const handle = createServeHandler({
      api: `http://127.0.0.1:${upstream.port}`,
      indexHtml: '<html>ok</html>',
      assets: {},
      agentHandle: async () => new Response(null, { status: 404 }),
      remoteAgentHandle: async () => new Response(null, { status: 404 }),
      allowedOrigins: ['http://localhost:8080'],
      agentBridge: false,
      agentTokenConfigured: false,
    });

    const res = await handle(
      new Request('http://localhost:8080/api/queues', {
        headers: {
          host: 'localhost:8080',
          cookie: 'session=dashboard-only',
          authorization: 'Bearer server-token',
          upgrade: 'websocket',
        },
      })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      host: `127.0.0.1:${upstream.port}`,
      cookie: null,
      authorization: 'Bearer server-token',
      upgrade: null,
    });
  });

  it('drops only hop-by-hop and browser-scoped headers', () => {
    const headers = upstreamHeaders(
      new Headers({
        host: 'dash.example.com',
        cookie: 'a=1',
        connection: 'keep-alive',
        'content-type': 'application/json',
        authorization: 'Bearer t',
      })
    );
    expect([...headers.keys()].sort()).toEqual(['authorization', 'content-type']);
  });
});

describe('Docker image asset caching', () => {
  it('never marks a missing fingerprinted asset as immutable', () => {
    const caddyfile = readFileSync(new URL('../docker/Caddyfile', import.meta.url), 'utf8');
    const assets = caddyfile.slice(caddyfile.indexOf('handle /assets/*'));
    expect(assets).toContain('header @asset Cache-Control "public, max-age=31536000, immutable"');
    expect(assets).toContain('header @missing Cache-Control "no-store"');
    expect(assets).not.toMatch(/^\s*header Cache-Control "public, max-age=31536000, immutable"/m);
  });
});

describe('bun start launcher', () => {
  it('waits longer than the agent drain before force-killing it', () => {
    expect(FORCE_KILL_AFTER_MS).toBeGreaterThan(AGENT_SHUTDOWN_GRACE_MS);
  });

  it('reports a signal-killed service as a failure', () => {
    expect(serviceExitCode(null)).toBe(1);
    expect(serviceExitCode(0)).toBe(0);
    expect(serviceExitCode(3)).toBe(3);
  });
});
