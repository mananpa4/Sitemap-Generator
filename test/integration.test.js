'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { generateSitemap } = require('../src/index');

function startTestServer() {
  const pages = {
    '/': '<html><head><title>Home</title></head><body><a href="/about">About</a><a href="/blog/post-1">Post 1</a><a href="https://external.example.com/">External</a></body></html>',
    '/about': '<html><body><a href="/">Home</a><a href="/hidden">Hidden</a></body></html>',
    '/blog/post-1': '<html><head><meta name="robots" content="noindex"></head><body><a href="/">Home</a></body></html>',
    '/hidden': '<html><body>secret</body></html>',
    '/robots.txt': 'User-agent: *\nDisallow: /hidden\n',
  };

  const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    if (pages[url]) {
      res.writeHead(200, { 'Content-Type': url.endsWith('robots.txt') ? 'text/plain' : 'text/html' });
      res.end(pages[url]);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
    }
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

test('crawls a local test site and writes a sitemap.xml', async (t) => {
  const server = await startTestServer();
  const { port } = server.address();
  const siteUrl = `http://127.0.0.1:${port}/`;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sitemap-gen-test-'));
  const outFile = path.join(tmpDir, 'sitemap.xml');

  t.after(() => {
    server.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const result = await generateSitemap({
    siteUrl,
    outFile,
    crawl: { concurrency: 2, requestDelay: 0 },
  });

  assert.ok(fs.existsSync(outFile));
  const xml = fs.readFileSync(outFile, 'utf8');

  // Home and About should be indexed.
  assert.match(xml, new RegExp(`<loc>${siteUrl}</loc>`));
  assert.match(xml, new RegExp(`<loc>${siteUrl}about</loc>`));

  // /blog/post-1 has meta robots noindex -> must be excluded from the sitemap.
  assert.doesNotMatch(xml, /blog\/post-1/);

  // /hidden is disallowed by robots.txt -> must never be fetched/indexed.
  assert.doesNotMatch(xml, /hidden/);

  // External domain must never be followed.
  assert.doesNotMatch(xml, /external\.example\.com/);

  assert.equal(result.entryCount, entryCountFromXml(xml));
});

function entryCountFromXml(xml) {
  return (xml.match(/<loc>/g) || []).length;
}
