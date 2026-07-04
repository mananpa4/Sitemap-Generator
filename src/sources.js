'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * Recursively scan a local static build directory (e.g. output of a
 * static site generator) for .html files and turn them into sitemap
 * entries, without needing to crawl over HTTP. Useful for fully
 * static sites or as a fast pre-deploy pass.
 *
 * @param {string} dir
 * @param {string} siteUrl base URL to prefix generated paths with
 * @param {object} opts
 * @param {string[]} [opts.extensions] file extensions to include (default ['.html', '.htm'])
 * @param {boolean} [opts.stripIndexHtml] turn /foo/index.html into /foo/
 */
function fromStaticDir(dir, siteUrl, opts = {}) {
  const { extensions = ['.html', '.htm'], stripIndexHtml = true } = opts;
  const entries = [];
  const base = new URL(siteUrl);

  function walk(current) {
    const items = fs.readdirSync(current, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(current, item.name);
      if (item.isDirectory()) {
        walk(fullPath);
      } else if (extensions.includes(path.extname(item.name).toLowerCase())) {
        let rel = path.relative(dir, fullPath).split(path.sep).join('/');
        if (stripIndexHtml && /(^|\/)index\.html?$/.test(rel)) {
          rel = rel.replace(/(^|\/)index\.html?$/, '$1');
        }
        const loc = new URL(rel, base).toString();
        const stat = fs.statSync(fullPath);
        entries.push({ loc, lastmod: stat.mtime.toISOString() });
      }
    }
  }

  walk(dir);
  return entries;
}

/**
 * Read a manual list of URLs from a .txt (one per line) or .json
 * (array of strings, or objects {loc, lastmod, changefreq, priority})
 * file and merge them in as sitemap entries.
 */
function fromUrlsFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.json') {
    const data = JSON.parse(content);
    return data.map((item) => (typeof item === 'string' ? { loc: item } : { ...item }));
  }

  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((loc) => ({ loc }));
}

module.exports = { fromStaticDir, fromUrlsFile };
