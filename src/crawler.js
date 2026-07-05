'use strict';

const { fetchUrl } = require('./http');
const { fetchRobotsTxt } = require('./robots');
const { parseHtml, stripHtmlToText } = require('./htmlParser');

const DEFAULT_EXCLUDED_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico', '.bmp',
  '.css', '.js', '.mjs', '.json', '.xml', '.map',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.zip', '.rar', '.7z', '.tar', '.gz',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.mp3', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm',
  '.exe', '.dmg', '.apk', '.iso',
];

function normalizeUrl(rawUrl, { stripQuerystring = false, stripHash = true } = {}) {
  const u = new URL(rawUrl);
  if (stripHash) u.hash = '';
  if (stripQuerystring) u.search = '';
  // Normalize trailing slash on root only; keep other paths as-is.
  if (u.pathname === '') u.pathname = '/';
  return u.toString();
}

function hasExcludedExtension(pathname, excludedExtensions) {
  const lower = pathname.toLowerCase();
  return excludedExtensions.some((ext) => lower.endsWith(ext));
}

/** Converts an HTTP Last-Modified header value into W3C/ISO 8601, as required by the sitemap protocol. */
function toIsoDate(httpDate) {
  if (!httpDate) return null;
  const d = new Date(httpDate);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function matchesAnyPattern(url, patterns) {
  return patterns.some((p) => {
    const re = p instanceof RegExp ? p : new RegExp(p);
    return re.test(url);
  });
}

/**
 * Simple async concurrency pool: runs `worker` over `items`, at most
 * `concurrency` in flight at once. `items` is treated as a dynamic
 * queue (worker may push more items onto it while running).
 */
async function runQueue(queue, concurrency, worker) {
  let active = 0;
  let index = 0;

  return new Promise((resolve, reject) => {
    let stopped = false;

    function pump() {
      if (stopped) return;
      if (index >= queue.length && active === 0) {
        resolve();
        return;
      }
      while (active < concurrency && index < queue.length) {
        const item = queue[index++];
        active++;
        Promise.resolve(worker(item))
          .catch((err) => {
            stopped = true;
            reject(err);
          })
          .finally(() => {
            active--;
            pump();
          });
      }
    }

    pump();
  });
}

/**
 * Crawl a site starting from one or more URLs, following same-origin
 * links, and return sitemap-ready entries.
 *
 * @param {object} opts
 * @param {string[]} opts.startUrls
 * @param {number} opts.maxDepth
 * @param {number} opts.maxUrls
 * @param {number} opts.concurrency
 * @param {number} opts.requestDelay ms delay between requests (per worker slot)
 * @param {number} opts.timeout
 * @param {number} opts.retries
 * @param {string} opts.userAgent
 * @param {boolean} opts.sameOriginOnly
 * @param {boolean} opts.stripQuerystring
 * @param {boolean} opts.respectRobotsTxt
 * @param {boolean} opts.respectMetaRobots
 * @param {boolean} opts.followCanonical
 * @param {boolean} opts.ignoreAMP
 * @param {string[]} opts.excludeExtensions
 * @param {(string|RegExp)[]} opts.excludePatterns
 * @param {import('./logger').Logger} opts.logger
 */
async function crawlSite(opts) {
  const {
    startUrls,
    maxDepth = Infinity,
    maxUrls = Infinity,
    concurrency = 5,
    requestDelay = 0,
    timeout = 10000,
    retries = 1,
    userAgent = 'SitemapGeneratorBot/1.0',
    sameOriginOnly = true,
    stripQuerystring = true,
    respectRobotsTxt = true,
    respectMetaRobots = true,
    followCanonical = true,
    ignoreAMP = true,
    excludeExtensions = DEFAULT_EXCLUDED_EXTENSIONS,
    excludePatterns = [],
    collectSeoData = false,
    logger = console,
  } = opts;

  const origin = new URL(startUrls[0]).origin;
  const robots = respectRobotsTxt ? await fetchRobotsTxt(origin, fetchUrl, userAgent) : null;

  const visited = new Set();
  const results = new Map(); // loc -> entry
  const seoPages = [];
  const queue = [];

  const stats = {
    visited: 0,
    excludedByRobots: 0,
    excludedByNoindex: 0,
    brokenLinks: [], // { url, status, error }
  };

  for (const raw of startUrls) {
    const norm = normalizeUrl(raw, { stripQuerystring });
    queue.push({ url: norm, depth: 0 });
    visited.add(norm);
  }

  let stoppedForLimit = false;

  await runQueue(queue, concurrency, async ({ url, depth }) => {
    if (stoppedForLimit || results.size >= maxUrls) {
      stoppedForLimit = true;
      return;
    }

    const parsed = new URL(url);

    if (hasExcludedExtension(parsed.pathname, excludeExtensions)) return;
    if (excludePatterns.length && matchesAnyPattern(url, excludePatterns)) return;
    if (ignoreAMP && /(^|[/?&])amp(\/|$|=|&)/i.test(parsed.pathname + parsed.search)) return;
    if (robots && !robots.isAllowed(parsed.pathname + parsed.search, userAgent)) {
      stats.excludedByRobots++;
      logger.verbose?.(`robots.txt disallow: ${url}`);
      return;
    }

    if (requestDelay > 0) await new Promise((r) => setTimeout(r, requestDelay));

    const res = await fetchUrl(url, { userAgent, timeout, retries });
    stats.visited++;

    if (!res.ok) {
      stats.brokenLinks.push({ url, status: res.status || 0, error: res.error || null });
      logger.warn?.(`Fetch failed (${res.status || res.error}): ${url}`);
      return;
    }

    const finalUrl = normalizeUrl(res.url, { stripQuerystring });
    if (sameOriginOnly && new URL(finalUrl).origin !== origin) return;

    let loc = finalUrl;
    let followLinks = depth < maxDepth;
    let shouldIndex = true;
    let links = [];

    if (res.contentType.includes('text/html') && res.body) {
      const parsedHtml = parseHtml(res.body);

      if (respectMetaRobots && parsedHtml.metaRobots) {
        if (parsedHtml.metaRobots.includes('noindex')) {
          shouldIndex = false;
          stats.excludedByNoindex++;
        }
        if (parsedHtml.metaRobots.includes('nofollow')) followLinks = false;
      }

      if (followCanonical && parsedHtml.canonical) {
        try {
          const canonicalAbs = new URL(parsedHtml.canonical, finalUrl).toString();
          loc = normalizeUrl(canonicalAbs, { stripQuerystring });
        } catch {
          /* ignore invalid canonical */
        }
      }

      links = parsedHtml.links;

      let internalLinksCount = 0;
      let externalLinksCount = 0;
      const baseForLinks = parsedHtml.base ? new URL(parsedHtml.base, finalUrl).toString() : finalUrl;

      for (const link of links) {
        let abs;
        try {
          abs = new URL(link.href, baseForLinks).toString();
        } catch {
          continue;
        }
        if (!/^https?:/i.test(abs)) continue; // skip mailto:, tel:, javascript:, etc.

        const isInternal = new URL(abs).origin === origin;
        if (isInternal) internalLinksCount++;
        else externalLinksCount++;

        if (!followLinks || link.rel.includes('nofollow')) continue;
        if (sameOriginOnly && !isInternal) continue;
        const normAbs = normalizeUrl(abs, { stripQuerystring });
        if (visited.has(normAbs)) continue;
        visited.add(normAbs);
        queue.push({ url: normAbs, depth: depth + 1 });
      }

      if (collectSeoData) {
        seoPages.push({
          url: loc,
          title: parsedHtml.title,
          metaDescription: parsedHtml.metaDescription,
          headings: parsedHtml.headings,
          images: parsedHtml.images,
          text: stripHtmlToText(res.body),
          internalLinksCount,
          externalLinksCount,
        });
      }
    }

    if (shouldIndex && results.size < maxUrls) {
      results.set(loc, {
        loc,
        lastmod: toIsoDate(res.lastModified),
        depth,
      });
    }
  });

  return { entries: Array.from(results.values()), stats, seoPages };
}

module.exports = {
  crawlSite,
  normalizeUrl,
  hasExcludedExtension,
  matchesAnyPattern,
  runQueue,
  DEFAULT_EXCLUDED_EXTENSIONS,
};
