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

const HEADING_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

function stripTags(html) {
  return html.replace(/<[^>]+>/g, ' ');
}

function decodeBasicEntities(text) {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

/**
 * Plain-text visible content of a page: strips <script>/<style>/<noscript>
 * blocks entirely (their content isn't visible text), then all remaining
 * tags, then collapses whitespace. Rough approximation, not a real
 * renderer — good enough for word counts and readability heuristics.
 */
function stripHtmlToText(html) {
  const withoutNonVisible = html
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const text = decodeBasicEntities(stripTags(withoutNonVisible));
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * @param {string} html
 * @returns {{
 *   links: Array<{href:string, rel:string}>,
 *   base: string|null,
 *   metaRobots: string|null,
 *   metaDescription: string|null,
 *   canonical: string|null,
 *   title: string|null,
 *   headings: Record<'h1'|'h2'|'h3'|'h4'|'h5'|'h6', string[]>,
 *   images: Array<{src: string, alt: string}>,
 * }}
 */
function parseHtml(html) {
  const links = [];
  const images = [];
  let base = null;
  let metaRobots = null;
  let metaDescription = null;
  let canonical = null;
  let title = null;

  const tagRegex = /<(a|base|meta|link|img)\b[^>]*>/gi;
  let m;
  while ((m = tagRegex.exec(html)) !== null) {
    const tagName = m[1].toLowerCase();
    const attrs = parseTagAttributes(m[0]);

    if (tagName === 'a' && attrs.href) {
      links.push({ href: attrs.href, rel: (attrs.rel || '').toLowerCase() });
    } else if (tagName === 'base' && attrs.href) {
      base = attrs.href;
    } else if (tagName === 'img' && attrs.src) {
      images.push({ src: attrs.src, alt: attrs.alt || '' });
    } else if (tagName === 'meta') {
      const name = (attrs.name || attrs.property || '').toLowerCase();
      if (name === 'robots' && attrs.content) {
        metaRobots = attrs.content.toLowerCase();
      } else if (name === 'description' && attrs.content !== undefined) {
        metaDescription = attrs.content.trim();
      }
    } else if (tagName === 'link') {
      const rel = (attrs.rel || '').toLowerCase();
      if (rel === 'canonical' && attrs.href) {
        canonical = attrs.href;
      }
    }
  }

  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (titleMatch) title = decodeBasicEntities(stripTags(titleMatch[1])).replace(/\s+/g, ' ').trim();

  const headings = { h1: [], h2: [], h3: [], h4: [], h5: [], h6: [] };
  const headingRegex = /<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let hm;
  while ((hm = headingRegex.exec(html)) !== null) {
    const level = hm[1].toLowerCase();
    const text = decodeBasicEntities(stripTags(hm[2])).replace(/\s+/g, ' ').trim();
    if (text) headings[level].push(text);
  }

  return { links, base, metaRobots, metaDescription, canonical, title, headings, images };
}

module.exports = { parseHtml, parseTagAttributes, stripHtmlToText, HEADING_TAGS };
