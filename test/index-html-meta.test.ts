import { describe, expect, test } from 'bun:test';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { prepareRuntimeIndexHtml } from '../scripts/servePolicy';

const ROOT = join(import.meta.dir, '..');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');

/** Content of the first `<meta>` or `<link>` whose attribute pair matches. */
function tag(attr: string, value: string, read: 'content' | 'href' = 'content'): string | null {
  const pattern = new RegExp(
    `<(?:meta|link)[^>]*${attr}="${value}"[^>]*?${read}="([^"]*)"|<(?:meta|link)[^>]*${read}="([^"]*)"[^>]*${attr}="${value}"`,
    's'
  );
  const match = html.match(pattern);
  return match ? (match[1] ?? match[2] ?? null) : null;
}

function pngSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(path);
  // PNG signature (8 bytes), IHDR length + type (8), then width and height as big-endian u32.
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe('index.html metadata', () => {
  test('carries the Qelay name and no pre-rebrand product name', () => {
    expect(html).toContain('<title>Qelay Control Panel</title>');
    expect(tag('property', 'og:site_name')).toBe('Qelay Control Panel');
    expect(tag('property', 'og:title')).toBe('Qelay Control Panel');
    expect(tag('name', 'twitter:title')).toBe('Qelay Control Panel');
    // The only allowed survivor is the pre-paint theme key fallback.
    const withoutFallback = html.replace("localStorage.getItem('bq-dash-theme')", '');
    expect(withoutFallback).not.toMatch(/bunqueue.?dashboard|egeominotti|bq-dash/i);
  });

  test('canonical, og:url and the image URLs share one origin', () => {
    const canonical = tag('rel', 'canonical', 'href');
    expect(canonical).toMatch(/^https:\/\/[^/]+\/qelay-control-panel\/$/);
    expect(tag('property', 'og:url')).toBe(canonical as string);
    expect(tag('property', 'og:image')).toBe(`${canonical}og.png`);
    expect(tag('name', 'twitter:image')).toBe(`${canonical}og.png`);
    expect(tag('name', 'twitter:card')).toBe('summary_large_image');
  });

  test('declares a dark and a light theme colour', () => {
    expect(html).toMatch(
      /name="theme-color"\s+content="#0B0F1A"\s+media="\(prefers-color-scheme: dark\)"/
    );
    expect(html).toMatch(
      /name="theme-color"\s+content="#FFFFFF"\s+media="\(prefers-color-scheme: light\)"/
    );
  });

  test('the share image is 1200x630, under 300 KB, and the tags say so', () => {
    const file = join(ROOT, 'public/og.png');
    const { width, height } = pngSize(file);
    expect({ width, height }).toEqual({ width: 1200, height: 630 });
    expect(statSync(file).size).toBeLessThan(300 * 1024);
    expect(tag('property', 'og:image:width')).toBe(String(width));
    expect(tag('property', 'og:image:height')).toBe(String(height));
    expect(tag('property', 'og:image:type')).toBe('image/png');
  });

  test('every local file the head links to exists', () => {
    for (const href of html.matchAll(/<link[^>]*\shref="(\/[^"]+)"/g)) {
      const path = href[1] as string;
      expect(() => statSync(join(ROOT, 'public', path))).not.toThrow();
    }
  });

  test('the standalone runtime rewrite accepts it and leaves absolute URLs alone', () => {
    const out = prepareRuntimeIndexHtml(html, '/internal/queue');
    expect(out).toContain('<base href="/internal/queue/" data-bunqueue-base>');
    expect(out).toContain('href="/internal/queue/favicon.svg"');
    expect(out).toContain('content="https://chxisb.github.io/qelay-control-panel/og.png"');
  });
});
