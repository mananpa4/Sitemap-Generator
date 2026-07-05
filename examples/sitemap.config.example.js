// Copia este archivo a sitemap.config.js en la raiz del proyecto y ajusta los valores.
// Uso: node bin/sitemap-generator.js --config sitemap.config.js
const { defineConfig } = require('../src/config');

module.exports = defineConfig({
  siteUrl: 'https://example.com',
  outFile: './output/sitemap.xml',

  crawl: {
    enabled: true,
    maxDepth: 5,
    maxUrls: 20000,
    concurrency: 5,
    requestDelay: 100,
    respectRobotsTxt: true,
    excludePatterns: [/\/admin\//, /\?print=/],
  },

  // Fuentes opcionales adicionales, se fusionan (dedupe por URL) con el resultado del crawl:
  // staticDir: './build',
  // urlsFile: './examples/urls.example.txt',
  // additionalUrls: ['https://example.com/pagina-oculta'],

  defaults: { changefreq: 'weekly', priority: 0.5 },
  priorityMap: [1.0, 0.8, 0.6, 0.4, 0.2],
  perUrlRules: [
    { pattern: /^https:\/\/example\.com\/?$/, changefreq: 'daily', priority: 1.0 },
    { pattern: /\/blog\//, changefreq: 'weekly', priority: 0.7 },
  ],

  gzip: false,
  updateRobotsTxt: true,
  robotsTxtFile: './output/robots.txt',

  ping: { enabled: false, engines: ['bing'] },
  indexNow: { enabled: false, key: null, host: 'example.com' },

  // Analisis SEO on-page nativo (sin dependencias) sobre cada URL crawleada.
  // Escribe ./output/sitemap-seo-report.json cuando enabled: true.
  seo: {
    enabled: false,
    focusKeyword: null, // p.ej. 'zapatos para correr'
    titleLength: { min: 40, max: 60 },
    descriptionLength: { min: 120, max: 156 },
    minWordCount: 300,
  },

  verbose: false,
  dryRun: false,
});
