'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { generateSitemap } = require('../src/index');

function startSeoTestServer() {
  const goodPage = `<html><head>
    <title>${'Great Cats Guide '.padEnd(50, 'x').slice(0, 50)}</title>
    <meta name="description" content="${'Learn everything about cats and their care. '.padEnd(140, 'y').slice(0, 140)}">
  </head><body>
    <h1>Cats</h1>
    <img src="/cat.png" alt="A cat">
    <a href="/other">Other page</a>
    <a href="https://external.example.com/">External</a>
    <p>${'Cats are wonderful pets that bring joy. '.repeat(40)}</p>
  </body></html>`;

  const thinPage = '<html><head><title></title></head><body><p>Too short.</p></body></html>';

  const pages = {
    '/': goodPage,
    '/other': thinPage,
  };

  const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    if (pages[url]) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(pages[url]);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
    }
  });

  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

test('writes a SEO report with per-page checks when seo.enabled is true', async (t) => {
  const server = await startSeoTestServer();
  const { port } = server.address();
  const siteUrl = `http://127.0.0.1:${port}/`;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sitemap-gen-seo-'));
  const outFile = path.join(tmpDir, 'sitemap.xml');

  t.after(() => {
    server.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const result = await generateSitemap({
    siteUrl,
    outFile,
    seo: { enabled: true, focusKeyword: 'cats' },
    crawl: { concurrency: 2 },
  });

  assert.ok(result.seoReport);
  assert.equal(result.seoReport.pages.length, 2);

  const seoReportPath = path.join(tmpDir, 'sitemap-seo-report.json');
  assert.ok(fs.existsSync(seoReportPath));

  const homePage = result.seoReport.pages.find((p) => p.url === siteUrl);
  const homeChecks = Object.fromEntries(homePage.checks.map((c) => [c.id, c.rating]));
  assert.equal(homeChecks.titleLength, 'good');
  assert.equal(homeChecks.descriptionLength, 'good');
  assert.equal(homeChecks.singleH1, 'good');
  assert.equal(homeChecks.imageAlt, 'good');
  assert.equal(homeChecks.keywordInTitle, 'good');

  const otherPage = result.seoReport.pages.find((p) => p.url.endsWith('/other'));
  const otherChecks = Object.fromEntries(otherPage.checks.map((c) => [c.id, c.rating]));
  assert.equal(otherChecks.titleLength, 'bad');
  assert.equal(otherChecks.descriptionLength, 'bad');
  assert.equal(otherChecks.singleH1, 'bad');
});

test('does not write a SEO report when seo.enabled is false (default)', async (t) => {
  const server = await startSeoTestServer();
  const { port } = server.address();
  const siteUrl = `http://127.0.0.1:${port}/`;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sitemap-gen-noseo-'));
  const outFile = path.join(tmpDir, 'sitemap.xml');

  t.after(() => {
    server.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const result = await generateSitemap({ siteUrl, outFile, crawl: { concurrency: 2 } });

  assert.equal(result.seoReport, null);
  assert.ok(!fs.existsSync(path.join(tmpDir, 'sitemap-seo-report.json')));
});
