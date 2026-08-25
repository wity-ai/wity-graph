import { defineConfig } from 'vitepress';

export default defineConfig({
  base:        '/stack/knowledge-graph/',
  title:       'wity-graph',
  description: 'Open-source headless graph library powering knowledge graph visualisation and agentic session replay in Wity AI. Zero dependencies. Three composable layers.',

  sitemap: {
    hostname: 'https://www.wity.ai',
  },

  head: [
    // Favicons
    ['link', { rel: 'icon',             type: 'image/x-icon',  href: 'https://www.wity.ai/assets/favicon/favicon.ico' }],
    ['link', { rel: 'icon',             type: 'image/png',     sizes: '32x32', href: 'https://www.wity.ai/assets/favicon/favicon-32x32.png' }],
    ['link', { rel: 'icon',             type: 'image/png',     sizes: '16x16', href: 'https://www.wity.ai/assets/favicon/favicon-16x16.png' }],
    ['link', { rel: 'apple-touch-icon', sizes: '180x180',      href: 'https://www.wity.ai/assets/favicon/apple-touch-icon.png' }],
    ['link', { rel: 'mask-icon',        href: 'https://www.wity.ai/assets/favicon/safari-pinned-tab.svg', color: '#000000' }],
    ['meta', { name: 'msapplication-TileImage', content: 'https://www.wity.ai/assets/favicon/mstile-150x150.png' }],
    ['meta', { name: 'theme-color', content: '#ffffff' }],

    // Canonical
    ['link', { rel: 'canonical', href: 'https://www.wity.ai/stack/knowledge-graph/' }],

    // Open Graph
    ['meta', { property: 'og:type',        content: 'website' }],
    ['meta', { property: 'og:site_name',   content: 'Wity AI' }],
    ['meta', { property: 'og:url',         content: 'https://www.wity.ai/stack/knowledge-graph/' }],
    ['meta', { property: 'og:title',       content: 'wity-graph — Open Source Knowledge Graph Library by Wity AI' }],
    ['meta', { property: 'og:description', content: 'The headless JavaScript graph library powering knowledge graphs and agentic session visualisation in Wity AI. Three composable layers — pure state, DOM bindings, temporal replay. Zero dependencies.' }],
    ['meta', { property: 'og:image',       content: 'https://uploads.wity.ai/user-uploads/accounts_wity_ai/ai_image_editor_uploads/2026_04_20T16_47_32_984Z-wity-ai-og-images.png' }],

    // Twitter
    ['meta', { name: 'twitter:card',        content: 'summary_large_image' }],
    ['meta', { name: 'twitter:creator',     content: '@wity__ai' }],
    ['meta', { name: 'twitter:url',         content: 'https://www.wity.ai/stack/knowledge-graph/' }],
    ['meta', { name: 'twitter:title',       content: 'wity-graph — Open Source Knowledge Graph Library by Wity AI' }],
    ['meta', { name: 'twitter:description', content: 'The headless JavaScript graph library powering knowledge graphs and agentic session visualisation in Wity AI. Three composable layers — pure state, DOM bindings, temporal replay. Zero dependencies.' }],
    ['meta', { name: 'twitter:image',       content: 'https://uploads.wity.ai/user-uploads/accounts_wity_ai/ai_image_editor_uploads/2026_04_20T16_47_32_984Z-wity-ai-og-images.png' }],

    // Additional meta
    ['meta', { name: 'author',   content: 'Wity AI' }],
    ['meta', { name: 'keywords', content: 'knowledge graph, headless graph library, javascript graph, agentic session, directed graph, graph visualisation, AI workflow graph, wity-graph, wity ai, open source' }],
    ['meta', { name: 'robots',   content: 'index, follow' }],

    // SoftwareSourceCode ld+json
    ['script', { type: 'application/ld+json' }, JSON.stringify({
      '@context': 'https://schema.org',
      '@type':    'SoftwareSourceCode',
      name:       'wity-graph',
      description: 'Open-source headless graph library powering knowledge graph visualisation and agentic session replay in Wity AI. Three composable layers — pure state, DOM bindings, temporal replay. Zero dependencies.',
      url:        'https://www.wity.ai/stack/knowledge-graph/',
      programmingLanguage: 'JavaScript',
      keywords:   'knowledge graph, headless graph library, agentic session, directed graph, javascript, graph visualisation',
      author: {
        '@type': 'Organization',
        name:    'Wity AI',
        url:     'https://www.wity.ai',
      },
      isPartOf: {
        '@type': 'WebSite',
        name:    'Wity AI',
        url:     'https://www.wity.ai',
      },
    })],

    // Organization ld+json — matches main site structured data
    ['script', { type: 'application/ld+json' }, JSON.stringify({
      '@context': 'https://schema.org',
      '@type':    'Organization',
      name:       'Wity AI',
      url:        'https://www.wity.ai',
      logo: {
        '@type': 'ImageObject',
        url:     'https://www.wity.ai/assets/imgs/vritti-logo-dark.png',
      },
      description: 'Wity AI builds AI-powered tools and platforms for brainstorming, content creation, and digital product workflows.',
      sameAs: [
        'https://twitter.com/wity__ai',
        'https://www.linkedin.com/company/wityai/',
        'https://www.youtube.com/@wity__ai',
        'https://www.jity.ai',
      ],
    })],
  ],

  themeConfig: {
    logo: {
      light: 'https://www.wity.ai/assets/imgs/vritti-logo-dark.png',
      dark:  'https://www.wity.ai/assets/imgs/vritti-logo-dark.png',
      alt:   'Wity AI',
    },

    nav: [
      { text: 'Guide',          link: '/guide/architecture' },
      { text: 'Packages',       link: '/packages/graph-headless' },
      { text: 'llms.txt',       link: '/stack/knowledge-graph/llms.txt' },
      { text: 'llms-full.txt',  link: '/stack/knowledge-graph/llms-full.txt' },
      { text: 'llms-api.txt',   link: '/stack/knowledge-graph/llms-api.txt' },
    ],

    sidebar: [
      {
        text:  'Guide',
        items: [
          { text: 'Architecture',       link: '/guide/architecture' },
          { text: 'Ontology',           link: '/guide/ontology' },
          { text: 'Actors & Sessions',  link: '/guide/actors-and-sessions' },
        ],
      },
      {
        text:  'Packages',
        items: [
          { text: '@wity/graph-headless',    link: '/packages/graph-headless' },
          { text: '@wity/graph-ui-compute',  link: '/packages/graph-ui-compute' },
          { text: '@wity/graph-player',      link: '/packages/graph-player' },
          { text: '@wity/graph-geo',         link: '/packages/graph-geo' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/wity-ai/wity-graph' },
    ],

    footer: {
      message: 'Part of the <a href="https://www.wity.ai">Wity AI</a> open-source stack · <a href="https://github.com/wity-ai/wity-graph">GitHub</a> · <a href="https://www.npmjs.com/package/@wity/graph-headless">npm</a>',
      copyright: '© 2026 Wity AI',
    },
  },
});
