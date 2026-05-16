import { defineConfig } from 'vitepress';

export default defineConfig({
  base:        '/stack/knowledge-graph/',
  title:       'wity-graph',
  description: 'Open-source headless graph library powering knowledge graph visualisation and agentic session replay in Wity AI. Zero dependencies. Three composable layers.',

  sitemap: {
    hostname: 'https://www.wity.ai',
  },

  head: [
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
        ],
      },
    ],

    socialLinks: [],

    footer: {
      message: 'wity-graph — zero dependencies, production-grade',
    },
  },
});
