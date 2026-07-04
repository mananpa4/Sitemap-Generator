'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildUrlsetXml,
  buildSitemapIndexXml,
  splitEntries,
  escapeXml,
} = require('../src/sitemapBuilder');

test('escapes special XML characters', () => {
  assert.equal(escapeXml('a & b < c > d " e \' f'), 'a &amp; b &lt; c &gt; d &quot; e &apos; f');
});

test('builds a basic urlset with lastmod/changefreq/priority', () => {
  const xml = buildUrlsetXml([
    { loc: 'https://example.com/', lastmod: '2026-01-01', changefreq: 'daily', priority: 1.0 },
  ]);
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.match(xml, /<loc>https:\/\/example\.com\/<\/loc>/);
  assert.match(xml, /<lastmod>2026-01-01<\/lastmod>/);
  assert.match(xml, /<changefreq>daily<\/changefreq>/);
  assert.match(xml, /<priority>1\.0<\/priority>/);
});

test('adds image namespace only when images are present', () => {
  const xml = buildUrlsetXml([
    { loc: 'https://example.com/gallery', images: [{ loc: 'https://example.com/img.png' }] },
  ]);
  assert.match(xml, /xmlns:image=/);
  assert.match(xml, /<image:loc>https:\/\/example\.com\/img\.png<\/image:loc>/);
});

test('builds sitemap index', () => {
  const xml = buildSitemapIndexXml([{ loc: 'https://example.com/sitemap-1.xml', lastmod: '2026-01-01' }]);
  assert.match(xml, /<sitemapindex/);
  assert.match(xml, /<loc>https:\/\/example\.com\/sitemap-1\.xml<\/loc>/);
});

test('splits entries by max URL count', () => {
  const entries = Array.from({ length: 10 }, (_, i) => ({ loc: `https://example.com/${i}` }));
  const chunks = splitEntries(entries, { maxUrlsPerFile: 3, maxBytesPerFile: 1e9 });
  assert.equal(chunks.length, 4);
  assert.equal(chunks[0].length, 3);
  assert.equal(chunks[3].length, 1);
});

test('splits entries by approximate byte size', () => {
  const entries = Array.from({ length: 5 }, (_, i) => ({ loc: `https://example.com/${'x'.repeat(50)}${i}` }));
  const chunks = splitEntries(entries, { maxUrlsPerFile: 1000, maxBytesPerFile: 300 });
  assert.ok(chunks.length > 1);
});
