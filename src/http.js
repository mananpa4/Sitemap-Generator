'use strict';

/**
 * Minimal HTTP client built on the global `fetch` (Node >= 18).
 * No external dependencies on purpose: keeps the tool installable
 * with just Node.js, matching the "zero dependency" spirit of the
 * reference crawlers this project consolidates.
 */

const DEFAULT_TIMEOUT = 10000;

/**
 * @param {string} url
 * @param {object} options
 * @param {string} options.userAgent
 * @param {number} options.timeout
 * @param {number} options.retries
 * @param {'GET'|'HEAD'} [options.method]
 */
async function fetchUrl(url, options = {}) {
  const {
    userAgent = 'SitemapGeneratorBot/1.0',
    timeout = DEFAULT_TIMEOUT,
    retries = 1,
    method = 'GET',
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(url, {
        method,
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': userAgent,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });
      clearTimeout(timer);

      const contentType = res.headers.get('content-type') || '';
      const lastModified = res.headers.get('last-modified') || null;
      const finalUrl = res.url || url;

      let body = '';
      if (method === 'GET') {
        body = await res.text();
      }

      return {
        ok: res.ok,
        status: res.status,
        url: finalUrl,
        contentType,
        lastModified,
        body,
      };
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (attempt < retries) continue;
    }
  }

  return {
    ok: false,
    status: 0,
    url,
    contentType: '',
    lastModified: null,
    body: '',
    error: lastError ? lastError.message : 'unknown error',
  };
}

module.exports = { fetchUrl, DEFAULT_TIMEOUT };
