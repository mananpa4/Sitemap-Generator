'use strict';

const fs = require('node:fs');

/**
 * Ensure a robots.txt file references the generated sitemap.
 * Non-destructive: creates a minimal permissive file if missing,
 * otherwise appends a `Sitemap:` line only if not already present.
 *
 * @param {string} robotsTxtPath
 * @param {string} sitemapUrl absolute URL of the sitemap (or sitemap index)
 */
function ensureSitemapReference(robotsTxtPath, sitemapUrl) {
  let content = '';
  let existed = false;

  if (fs.existsSync(robotsTxtPath)) {
    content = fs.readFileSync(robotsTxtPath, 'utf8');
    existed = true;
  }

  const alreadyPresent = content
    .split(/\r?\n/)
    .some((line) => line.trim().toLowerCase() === `sitemap: ${sitemapUrl}`.toLowerCase());

  if (alreadyPresent) return { changed: false, created: false };

  if (!existed) {
    content = 'User-agent: *\nAllow: /\n';
  }

  if (!content.endsWith('\n')) content += '\n';
  content += `\nSitemap: ${sitemapUrl}\n`;

  fs.writeFileSync(robotsTxtPath, content, 'utf8');
  return { changed: true, created: !existed };
}

module.exports = { ensureSitemapReference };
