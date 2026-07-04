'use strict';

/**
 * Lightweight, dependency-free HTML link/meta extraction using
 * attribute-order-independent regex tokenizing. Good enough for
 * sitemap crawling purposes (we don't need a full DOM).
 */

function parseTagAttributes(tagStr) {
  const attrs = {};
  const attrRegex = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*("([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let match;
  let first = true;
  while ((match = attrRegex.exec(tagStr)) !== null) {
    if (first) {
      // first match is the tag name itself (e.g. "a", "meta")
      first = false;
      continue;
    }
    const name = match[1].toLowerCase();
    const value = match[3] ?? match[4] ?? match[5] ?? '';
    attrs[name] = value;
  }
  return attrs;
}

/**
 * @param {string} html
 * @returns {{ links: Array<{href:string, rel:string}>, base: string|null,
 *             metaRobots: string|null, canonical: string|null,
 *             title: string|null }}
 */
function parseHtml(html) {
  const links = [];
  let base = null;
  let metaRobots = null;
  let canonical = null;
  let title = null;

  const tagRegex = /<(a|base|meta|link)\b[^>]*>/gi;
  let m;
  while ((m = tagRegex.exec(html)) !== null) {
    const tagName = m[1].toLowerCase();
    const attrs = parseTagAttributes(m[0]);

    if (tagName === 'a' && attrs.href) {
      links.push({ href: attrs.href, rel: (attrs.rel || '').toLowerCase() });
    } else if (tagName === 'base' && attrs.href) {
      base = attrs.href;
    } else if (tagName === 'meta') {
      const name = (attrs.name || attrs.property || '').toLowerCase();
      if (name === 'robots' && attrs.content) {
        metaRobots = attrs.content.toLowerCase();
      }
    } else if (tagName === 'link') {
      const rel = (attrs.rel || '').toLowerCase();
      if (rel === 'canonical' && attrs.href) {
        canonical = attrs.href;
      }
    }
  }

  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (titleMatch) title = titleMatch[1].trim();

  return { links, base, metaRobots, canonical, title };
}

module.exports = { parseHtml, parseTagAttributes };
