'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_CONFIG = {
  siteUrl: null,
  outFile: './sitemap.xml',

  robotsTxtFile: null,
  updateRobotsTxt: false,

  sitemapsHost: null,
  sitemapsPath: '',

  gzip: false,
  txtSitemap: false,
  report: true,
  maxUrlsPerFile: 50000,
  maxBytesPerFile: 50 * 1024 * 1024,

  crawl: {
    enabled: true,
    startUrls: null,
    maxDepth: Infinity,
    maxUrls: Infinity,
    concurrency: 5,
    requestDelay: 0,
    timeout: 10000,
    retries: 1,
    userAgent: 'SitemapGeneratorBot/1.0 (+https://github.com/)',
    sameOriginOnly: true,
    stripQuerystring: true,
    respectRobotsTxt: true,
    respectMetaRobots: true,
    followCanonical: true,
    ignoreAMP: true,
    excludeExtensions: null,
    excludePatterns: [],
  },

  staticDir: null,
  urlsFile: null,
  additionalUrls: [],

  defaults: { changefreq: null, priority: null },
  priorityMap: null,
  perUrlRules: [],

  ping: { enabled: false, engines: ['bing'] },
  indexNow: { enabled: false, key: null, keyLocation: null, host: null },

  verbose: false,
  dryRun: false,
};

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function deepMerge(target, source) {
  const out = { ...target };
  for (const key of Object.keys(source || {})) {
    const sVal = source[key];
    if (isPlainObject(sVal) && isPlainObject(target[key])) {
      out[key] = deepMerge(target[key], sVal);
    } else if (sVal !== undefined) {
      out[key] = sVal;
    }
  }
  return out;
}

/**
 * Loads a config file (.js or .json), merges it over the defaults.
 * Pass `null` to use only defaults (+ overrides).
 */
function loadConfig(configPath, overrides = {}) {
  let fileConfig = {};

  if (configPath) {
    const resolved = path.resolve(configPath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Config file not found: ${resolved}`);
    }
    if (resolved.endsWith('.json')) {
      fileConfig = JSON.parse(fs.readFileSync(resolved, 'utf8'));
    } else {
      delete require.cache[require.resolve(resolved)];
      const mod = require(resolved);
      fileConfig = mod.default || mod;
    }
  }

  let merged = deepMerge(DEFAULT_CONFIG, fileConfig);
  merged = deepMerge(merged, overrides);

  if (!merged.crawl.excludeExtensions) {
    merged.crawl.excludeExtensions = require('./crawler').DEFAULT_EXCLUDED_EXTENSIONS;
  }
  if (!merged.crawl.startUrls) {
    merged.crawl.startUrls = merged.siteUrl ? [merged.siteUrl] : null;
  }

  return merged;
}

/** Identity helper for editor autocompletion in JS config files. */
function defineConfig(config) {
  return config;
}

module.exports = { loadConfig, defineConfig, deepMerge, DEFAULT_CONFIG };
