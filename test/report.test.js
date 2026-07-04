'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { generateSitemap } = require('../src/index');

function startServerWithBrokenLink() {
  const pages = {
    '/': '<html><body><a href="/ok">Ok</a><a href="/missing">Missing</a></body></html>',
    '/ok': '<html><body>ok</body></html>',
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

test('writes a JSON report with broken links and a txt sitemap when enabled', async (t) => {
  const server = await startServerWithBrokenLink();
  const { port } = server.address();
  const siteUrl = `http://127.0.0.1:${port}/`;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sitemap-gen-report-'));
  const outFile = path.join(tmpDir, 'sitemap.xml');

  t.after(() => {
    server.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const result = await generateSitemap({
    siteUrl,
    outFile,
    txtSitemap: true,
    crawl: { concurrency: 2 },
  });

  assert.ok(result.report);
  assert.equal(result.report.crawl.brokenLinks.length, 1);
  assert.match(result.report.crawl.brokenLinks[0].url, /missing/);

  const reportPath = path.join(tmpDir, 'sitemap-report.json');
  assert.ok(fs.existsSync(reportPath));

  const txtPath = path.join(tmpDir, 'sitemap.txt');
  assert.ok(fs.existsSync(txtPath));
  const txt = fs.readFileSync(txtPath, 'utf8');
  assert.match(txt, new RegExp(siteUrl));
  assert.match(txt, /\/ok/);
});
