import type { HeadConfig, PageData } from 'vitepress';

// Canonical production origin for SEO (sitemap, canonical links, og:url).
// CONFIRM: derived from the repo name (<owner>.github.io/<repo>/docs), not a confirmed host.
// The app's index.html and package.json homepage use the same origin; change all three together.
export const APP_URL = 'https://chxisb.github.io/qelay-control-panel/';
export const SITE = `${APP_URL}docs`;
export const SITE_NAME = 'Qelay Control Panel';
export const SITE_DESCRIPTION =
  'How Qelay Control Panel works: an illustrated, user-first guide to every page, plus deployment (Docker, Kubernetes, PM2), the architecture, and the HTTP API it drives.';

// The GitHub account that owns this fork (from the repository URL). The original author is
// credited through `isBasedOn` below; the fork's own publisher line is the user's call (D6).
const OWNER = { name: 'ChxisB', url: 'https://github.com/ChxisB' };
const UPSTREAM = {
  name: 'bunqueue-dashboard',
  url: 'https://github.com/egeominotti/bunqueue-dashboard',
  author: 'Egeo Minotti',
};

export function siteHead(base: string): HeadConfig[] {
  return [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: `${base}favicon.svg` }],
    ['meta', { name: 'theme-color', content: '#0B0F1A', media: '(prefers-color-scheme: dark)' }],
    ['meta', { name: 'theme-color', content: '#FFFFFF', media: '(prefers-color-scheme: light)' }],
    ['meta', { name: 'author', content: OWNER.name }],
    [
      'meta',
      {
        name: 'keywords',
        content:
          'qelay, control panel, bunqueue, queue, jobs, dead-letter queue, cron, webhooks, workers, react, vite, bun',
      },
    ],
    [
      'meta',
      {
        name: 'robots',
        content: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
      },
    ],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: `${SITE_NAME} docs` }],
    ['meta', { property: 'og:locale', content: 'en_US' }],
    ['meta', { property: 'og:image', content: `${SITE}/og.png` }],
    ['meta', { property: 'og:image:type', content: 'image/png' }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],
    [
      'meta',
      {
        property: 'og:image:alt',
        content: 'Qelay Control Panel documentation: guides, deploy recipes and the API',
      },
    ],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:image', content: `${SITE}/og.png` }],
    [
      'meta',
      {
        name: 'twitter:image:alt',
        content: 'Qelay Control Panel documentation: guides, deploy recipes and the API',
      },
    ],
  ];
}

/** Add canonical metadata and a linked schema.org graph to each generated page. */
export function transformPageData(pageData: PageData): void {
  const clean = pageData.relativePath.replace(/index\.md$/, '').replace(/\.md$/, '');
  const canonical = `${SITE}/${clean}`.replace(/\/$/, clean === '' ? '/' : '');
  const title = pageData.frontmatter.title || pageData.title || SITE_NAME;
  const description =
    pageData.frontmatter.description ||
    pageData.description ||
    'An illustrated, user-first guide to Qelay Control Panel.';
  pageData.frontmatter.head ??= [];
  pageData.frontmatter.head.push(
    ['link', { rel: 'canonical', href: canonical }],
    ['meta', { property: 'og:url', content: canonical }],
    ['meta', { property: 'og:title', content: `${title} · ${SITE_NAME} docs` }],
    ['meta', { property: 'og:description', content: description }],
    ['meta', { name: 'description', content: description }],
    ['meta', { name: 'twitter:title', content: `${title} · ${SITE_NAME} docs` }],
    ['meta', { name: 'twitter:description', content: description }]
  );

  const isHome = clean === '';
  const person = { '@id': `${SITE}/#person` };
  const website = { '@id': `${SITE}/#website` };
  const graph: Record<string, unknown>[] = [
    {
      '@type': 'WebSite',
      '@id': `${SITE}/#website`,
      url: `${SITE}/`,
      name: `${SITE_NAME} docs`,
      description:
        'How Qelay Control Panel works: an illustrated, user-first guide to every page, plus deployment, the architecture, and the HTTP API it drives.',
      inLanguage: 'en-US',
      publisher: person,
    },
    {
      '@type': 'Person',
      '@id': `${SITE}/#person`,
      name: OWNER.name,
      url: OWNER.url,
    },
    {
      '@type': 'WebPage',
      '@id': `${canonical}#webpage`,
      url: canonical,
      name: `${title} · ${SITE_NAME} docs`,
      description,
      isPartOf: website,
      inLanguage: 'en-US',
      primaryImageOfPage: `${SITE}/og.png`,
      ...(isHome ? {} : { breadcrumb: { '@id': `${canonical}#breadcrumb` } }),
    },
  ];
  if (isHome) {
    graph.push({
      '@type': 'SoftwareApplication',
      '@id': `${SITE}/#software`,
      name: SITE_NAME,
      description,
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Web, Docker, Linux, macOS, Windows',
      url: APP_URL,
      isBasedOn: {
        '@type': 'SoftwareApplication',
        name: UPSTREAM.name,
        url: UPSTREAM.url,
        author: { '@type': 'Person', name: UPSTREAM.author },
      },
      image: `${SITE}/og.png`,
      author: person,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      license: 'https://opensource.org/licenses/MIT',
      isAccessibleForFree: true,
    });
  } else {
    graph.push(
      {
        '@type': 'TechArticle',
        headline: title,
        description,
        url: canonical,
        inLanguage: 'en-US',
        image: `${SITE}/og.png`,
        author: person,
        publisher: person,
        isPartOf: website,
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonical}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: title, item: canonical },
        ],
      }
    );
  }
  pageData.frontmatter.head.push([
    'script',
    { type: 'application/ld+json' },
    JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }),
  ]);
}
