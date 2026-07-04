'use strict';

const crypto = require('node:crypto');

/**
 * Legacy "ping" endpoints that ask a search engine to re-fetch a
 * sitemap. NOTE: Google retired its sitemap ping endpoint in June
 * 2023 — submitting via Search Console (or its API) is the only way
 * to notify Google now. Bing's ping endpoint still works as of this
 * writing. Kept intentionally tiny; not a hard dependency of the
 * main flow.
 */
const PING_ENDPOINTS = {
  bing: (sitemapUrl) => `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
  google: (sitemapUrl) => `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
};

async function pingSearchEngines(sitemapUrl, engines = ['bing'], logger = console) {
  const results = [];
  for (const engine of engines) {
    const buildUrl = PING_ENDPOINTS[engine];
    if (!buildUrl) {
      logger.warn?.(`Unknown ping engine "${engine}", skipping.`);
      continue;
    }
    if (engine === 'google') {
      logger.warn?.('Google retired the sitemap ping endpoint in June 2023; this request will likely be ignored. Submit via Search Console instead.');
    }
    try {
      const res = await fetch(buildUrl(sitemapUrl), { method: 'GET' });
      results.push({ engine, ok: res.ok, status: res.status });
      logger.info?.(`Pinged ${engine}: ${res.status}`);
    } catch (err) {
      results.push({ engine, ok: false, error: err.message });
      logger.warn?.(`Ping to ${engine} failed: ${err.message}`);
    }
  }
  return results;
}

/**
 * Submit URLs via the IndexNow protocol (supported by Bing, Yandex,
 * Seznam, Naver). This is the modern successor to search-engine
 * pinging and is the recommended way to proactively notify engines
 * (other than Google, which uses its own Indexing API/Search Console).
 * https://www.indexnow.org/
 *
 * @param {string[]} urls
 * @param {object} opts
 * @param {string} opts.host e.g. "example.com"
 * @param {string} opts.key IndexNow key (also must be hosted at /<key>.txt)
 * @param {string} [opts.keyLocation] full URL to the key file, if not at the default location
 */
async function submitIndexNow(urls, opts, logger = console) {
  const { host, key, keyLocation } = opts;
  if (!host || !key) throw new Error('IndexNow requires "host" and "key".');

  const body = {
    host,
    key,
    keyLocation: keyLocation || `https://${host}/${key}.txt`,
    urlList: urls,
  };

  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
    });
    logger.info?.(`IndexNow submission: ${res.status} (${urls.length} urls)`);
    return { ok: res.ok, status: res.status };
  } catch (err) {
    logger.warn?.(`IndexNow submission failed: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

function generateIndexNowKey() {
  return crypto.randomBytes(16).toString('hex');
}

module.exports = { pingSearchEngines, submitIndexNow, generateIndexNowKey, PING_ENDPOINTS };
