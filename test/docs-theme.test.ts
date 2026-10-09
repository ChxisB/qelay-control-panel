import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const DOCS = readFileSync(new URL('../docs/.vitepress/theme/custom.css', import.meta.url), 'utf8');
const APP = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

type Rgb = readonly [number, number, number];
type Rgba = readonly [number, number, number, number];
type Theme = 'dark' | 'light';
type Tokens = Map<string, string>;

/** Custom properties declared in the first rule of `css` whose selector line is `selector`. */
function declarations(css: string, selector: string): Tokens {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`no "${selector}" block`);
  const body = css.slice(start, css.indexOf('\n}', start));
  const out: Tokens = new Map();
  for (const m of body.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)) {
    out.set(m[1] ?? '', (m[2] ?? '').replace(/\s+/g, ' ').trim());
  }
  return out;
}

// VitePress: `:root` is light and `.dark` overrides it. App: `[data-theme="dark"]` is the default
// and `[data-theme="light"]` overrides it.
const DOCS_TOKENS: Record<Theme, Tokens> = {
  light: declarations(DOCS, ':root'),
  dark: new Map([...declarations(DOCS, ':root'), ...declarations(DOCS, '.dark')]),
};
const APP_TOKENS: Record<Theme, Tokens> = {
  dark: declarations(APP, '[data-theme="dark"]'),
  light: new Map([
    ...declarations(APP, '[data-theme="dark"]'),
    ...declarations(APP, '[data-theme="light"]'),
  ]),
};

function parseColour(value: string): Rgba {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
  if (hex) {
    const h = hex[1] ?? '';
    const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
    const n = Number.parseInt(full, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const rgba = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(value);
  if (rgba) return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3]), Number(rgba[4] ?? 1)];
  throw new Error(`unsupported colour "${value}"`);
}

function luminance([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

function docs(theme: Theme, name: string): string {
  const v = DOCS_TOKENS[theme].get(`--${name}`);
  if (v === undefined) throw new Error(`docs --${name} is not defined for ${theme}`);
  return v;
}

function app(theme: Theme, name: string): string {
  const v = APP_TOKENS[theme].get(`--${name}`);
  if (v === undefined) throw new Error(`app --${name} is not defined for ${theme}`);
  return v;
}

/** Opaque colour of a docs token (translucent ones are not used for text, so none are blended). */
function solid(theme: Theme, name: string): Rgb {
  const [r, g, b] = parseColour(docs(theme, name));
  return [r, g, b];
}

const THEMES: readonly Theme[] = ['light', 'dark'];

describe('docs theme tokens follow the app tokens', () => {
  // [docs token, app token]. The docs copy the app's values because VitePress cannot import them.
  const PAIRS: Record<Theme, ReadonlyArray<readonly [string, string]>> = {
    light: [
      ['vp-c-bg', 'bg'],
      ['vp-c-bg-soft', 'surface-2'],
      ['vp-c-bg-alt', 'surface-2'],
      ['vp-c-divider', 'line'],
      ['vp-c-border', 'line-strong'],
      ['vp-c-text-1', 'text'],
      ['vp-c-text-2', 'text-muted'],
      ['vp-c-brand-1', 'link'],
      ['qelay-primary', 'primary'],
      ['qelay-primary-fg', 'primary-fg'],
    ],
    dark: [
      ['vp-c-bg', 'bg'],
      ['vp-c-bg-soft', 'surface'],
      ['vp-c-bg-alt', 'surface'],
      ['vp-c-bg-elv', 'surface-2'],
      ['vp-c-divider', 'line'],
      ['vp-c-border', 'line-strong'],
      ['vp-c-text-1', 'text'],
      ['vp-c-text-2', 'text-muted'],
      ['vp-c-text-3', 'text-faint'],
      ['vp-c-brand-1', 'link'],
      ['qelay-primary', 'primary'],
      ['qelay-primary-fg', 'primary-fg'],
    ],
  };

  for (const theme of THEMES) {
    for (const [docsName, appName] of PAIRS[theme]) {
      test(`${theme}: --${docsName} matches the app's --${appName}`, () => {
        expect(docs(theme, docsName).toLowerCase()).toBe(app(theme, appName).toLowerCase());
      });
    }
  }

  test('the gradient runs through the three brand stops, in order', () => {
    const stops = ['brand-1', 'brand-2', 'brand-3'].map((n) => app('dark', n).toLowerCase());
    const gradient = docs('light', 'qelay-gradient').toLowerCase();
    const positions = stops.map((hex) => gradient.indexOf(hex));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });
});

describe('docs text meets WCAG AA (4.5:1) in both themes', () => {
  const TEXT = ['vp-c-text-1', 'vp-c-text-2', 'vp-c-text-3'];
  const SURFACES = ['vp-c-bg', 'vp-c-bg-soft'];

  for (const theme of THEMES) {
    for (const text of TEXT) {
      for (const surface of SURFACES) {
        test(`${theme}: --${text} on --${surface}`, () => {
          expect(contrast(solid(theme, text), solid(theme, surface))).toBeGreaterThanOrEqual(4.5);
        });
      }
    }

    // Links are violet text; the dark theme uses the lighter tint, as the app does.
    for (const surface of SURFACES) {
      test(`${theme}: link text on --${surface}`, () => {
        const link = solid(theme, 'vp-c-brand-1');
        expect(contrast(link, solid(theme, surface))).toBeGreaterThanOrEqual(4.5);
      });
    }

    test(`${theme}: inline code on its background`, () => {
      const ratio = contrast(solid(theme, 'vp-code-color'), solid(theme, 'vp-code-bg'));
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    test(`${theme}: dark text on the orange primary button`, () => {
      const ratio = contrast(solid(theme, 'qelay-primary-fg'), solid(theme, 'qelay-primary'));
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  }
});
