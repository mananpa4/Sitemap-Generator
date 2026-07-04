'use strict';

const zlib = require('node:zlib');

const NS_BASE = 'http://www.sitemaps.org/schemas/sitemap/0.9';
const NS_IMAGE = 'http://www.google.com/schemas/sitemap-image/1.1';
const NS_VIDEO = 'http://www.google.com/schemas/sitemap-video/1.1';
const NS_NEWS = 'http://www.google.com/schemas/sitemap-news/0.9';
const NS_XHTML = 'http://www.w3.org/1999/xhtml';

const MAX_URLS_PER_FILE = 50000;
const MAX_BYTES_PER_FILE = 50 * 1024 * 1024; // 50MB, Google's sitemap protocol limit

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildUrlEntryXml(entry) {
  let xml = '  <url>\n';
  xml += `    <loc>${escapeXml(entry.loc)}</loc>\n`;
  if (entry.lastmod) xml += `    <lastmod>${escapeXml(entry.lastmod)}</lastmod>\n`;
  if (entry.changefreq) xml += `    <changefreq>${escapeXml(entry.changefreq)}</changefreq>\n`;
  if (entry.priority !== undefined && entry.priority !== null) {
    xml += `    <priority>${Number(entry.priority).toFixed(1)}</priority>\n`;
  }

  if (Array.isArray(entry.images)) {
    for (const img of entry.images) {
      xml += '    <image:image>\n';
      xml += `      <image:loc>${escapeXml(img.loc)}</image:loc>\n`;
      if (img.title) xml += `      <image:title>${escapeXml(img.title)}</image:title>\n`;
      if (img.caption) xml += `      <image:caption>${escapeXml(img.caption)}</image:caption>\n`;
      xml += '    </image:image>\n';
    }
  }

  if (Array.isArray(entry.videos)) {
    for (const v of entry.videos) {
      xml += '    <video:video>\n';
      if (v.thumbnailLoc) xml += `      <video:thumbnail_loc>${escapeXml(v.thumbnailLoc)}</video:thumbnail_loc>\n`;
      if (v.title) xml += `      <video:title>${escapeXml(v.title)}</video:title>\n`;
      if (v.description) xml += `      <video:description>${escapeXml(v.description)}</video:description>\n`;
      if (v.contentLoc) xml += `      <video:content_loc>${escapeXml(v.contentLoc)}</video:content_loc>\n`;
      xml += '    </video:video>\n';
    }
  }

  if (entry.news) {
    const n = entry.news;
    xml += '    <news:news>\n';
    xml += '      <news:publication>\n';
    xml += `        <news:name>${escapeXml(n.publicationName || '')}</news:name>\n`;
    xml += `        <news:language>${escapeXml(n.language || 'en')}</news:language>\n`;
    xml += '      </news:publication>\n';
    if (n.publicationDate) xml += `      <news:publication_date>${escapeXml(n.publicationDate)}</news:publication_date>\n`;
    if (n.title) xml += `      <news:title>${escapeXml(n.title)}</news:title>\n`;
    xml += '    </news:news>\n';
  }

  if (Array.isArray(entry.alternates)) {
    for (const alt of entry.alternates) {
      xml += `    <xhtml:link rel="alternate" hreflang="${escapeXml(alt.hreflang)}" href="${escapeXml(alt.href)}" />\n`;
    }
  }

  xml += '  </url>\n';
  return xml;
}

function detectNamespaces(entries) {
  const ns = { image: false, video: false, news: false, xhtml: false };
  for (const e of entries) {
    if (e.images?.length) ns.image = true;
    if (e.videos?.length) ns.video = true;
    if (e.news) ns.news = true;
    if (e.alternates?.length) ns.xhtml = true;
  }
  return ns;
}

function buildUrlsetXml(entries) {
  const ns = detectNamespaces(entries);
  let attrs = `xmlns="${NS_BASE}"`;
  if (ns.image) attrs += ` xmlns:image="${NS_IMAGE}"`;
  if (ns.video) attrs += ` xmlns:video="${NS_VIDEO}"`;
  if (ns.news) attrs += ` xmlns:news="${NS_NEWS}"`;
  if (ns.xhtml) attrs += ` xmlns:xhtml="${NS_XHTML}"`;

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += `<urlset ${attrs}>\n`;
  for (const entry of entries) xml += buildUrlEntryXml(entry);
  xml += '</urlset>\n';
  return xml;
}

function buildSitemapIndexXml(sitemaps) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += `<sitemapindex xmlns="${NS_BASE}">\n`;
  for (const sm of sitemaps) {
    xml += '  <sitemap>\n';
    xml += `    <loc>${escapeXml(sm.loc)}</loc>\n`;
    if (sm.lastmod) xml += `    <lastmod>${escapeXml(sm.lastmod)}</lastmod>\n`;
    xml += '  </sitemap>\n';
  }
  xml += '</sitemapindex>\n';
  return xml;
}

/**
 * Split entries into chunks that respect both the max URL count and
 * an approximate max byte size per file (Google's sitemap protocol
 * limits: 50,000 URLs / 50MB uncompressed per file).
 */
function splitEntries(entries, { maxUrlsPerFile = MAX_URLS_PER_FILE, maxBytesPerFile = MAX_BYTES_PER_FILE } = {}) {
  const chunks = [];
  let current = [];
  let currentBytes = 100; // rough overhead for the urlset wrapper

  for (const entry of entries) {
    const approxSize = Buffer.byteLength(buildUrlEntryXml(entry), 'utf8');
    const wouldExceedCount = current.length + 1 > maxUrlsPerFile;
    const wouldExceedBytes = currentBytes + approxSize > maxBytesPerFile;

    if ((wouldExceedCount || wouldExceedBytes) && current.length > 0) {
      chunks.push(current);
      current = [];
      currentBytes = 100;
    }

    current.push(entry);
    currentBytes += approxSize;
  }

  if (current.length > 0) chunks.push(current);
  return chunks;
}

function gzip(buffer) {
  return zlib.gzipSync(buffer);
}

/** Plain-text sitemap: one absolute URL per line (supported by Google/Bing as an alternative to XML). */
function buildTxtSitemap(entries) {
  return entries.map((e) => e.loc).join('\n') + '\n';
}

module.exports = {
  escapeXml,
  buildUrlEntryXml,
  buildUrlsetXml,
  buildSitemapIndexXml,
  buildTxtSitemap,
  splitEntries,
  gzip,
  MAX_URLS_PER_FILE,
  MAX_BYTES_PER_FILE,
};
