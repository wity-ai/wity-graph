import { defineConfig } from 'vitepress';

export default defineConfig({
  base:        '/stack/wity-graph/',
  title:       'wity-graph',
  description: 'A headless, ontologically-grounded directed graph library. Zero dependencies. Production-grade.',

  themeConfig: {
    nav: [
      { text: 'Guide',     link: '/guide/architecture' },
      { text: 'Packages',  link: '/packages/graph-headless' },
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
