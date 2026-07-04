'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { loadConfig, defineConfig } = require('./config');
const { crawlSite } = require('./crawler');
const { fromStaticDir, fromUrlsFile } = require('./sources');
const { buildUrlsetXml, buildSitemapIndexXml, buildTxtSitemap, splitEntries, gzip } = require('./sitemapBuilder');
const { ensureSitemapReference } = require('./robotsTxtWriter');
const { pingSearchEngines, submitIndexNow } = require('./ping');
const { Logger } = require('./logger');

function applyRulesAndDefaults(entries, config) {
  const { defaults = {}, priorityMap, perUrlRules = [] } = config;

  return entries.map((entry) => {
    const out = { ...entry };

    if (out.changefreq === undefined || out.changefreq === null) {
      out.changefreq = defaults.changefreq ?? null;
    }
    if (out.priority === undefined || out.priority === null) {
      if (Array.isArray(priorityMap) && typeof out.depth === 'number') {
        const idx = Math.min(out.depth, priorityMap.length - 1);
        out.priority = priorityMap[idx] ?? priorityMap[priorityMap.length - 1];
      } else {
        out.priority = defaults.priority ?? null;
      }
    }

    for (const rule of perUrlRules) {
      const re = rule.pattern instanceof RegExp ? rule.pattern : new RegExp(rule.pattern);
      if (re.test(out.loc)) {
        if (rule.changefreq !== undefined) out.changefreq = rule.changefreq;
        if (rule.priority !== undefined) out.priority = rule.priority;
      }
    }

    delete out.depth;
    return out;
  });
}

function dedupeEntries(entryLists) {
  const map = new Map();
  for (const list of entryLists) {
    for (const entry of list) {
      const existing = map.get(entry.loc) || {};
      map.set(entry.loc, { ...existing, ...entry });
    }
  }
  return Array.from(map.values());
}

function buildPublicUrl(fileName, config) {
  const host = config.sitemapsHost || config.siteUrl;
  if (!host) return fileName; // best effort; index will contain a relative path
  const prefix = config.sitemapsPath ? config.sitemapsPath.replace(/^\/|\/$/g, '') + '/' : '';
  return new URL(prefix + fileName, host).toString();
}

async function generateSitemap(configPath, cliOverrides = {}) {
  const config = typeof configPath === 'object' && configPath !== null && !Array.isArray(configPath)
    ? loadConfig(null, configPath)
    : loadConfig(configPath, cliOverrides);

  const logger = new Logger(config.verbose ? 'verbose' : 'info');
  const startedAt = Date.now();

  const hasAnySource = config.siteUrl
    || (config.crawl.startUrls && config.crawl.startUrls.length > 0)
    || config.staticDir
    || config.urlsFile
    || (config.additionalUrls && config.additionalUrls.length > 0);

  if (!hasAnySource) {
    throw new Error(
      'No hay ninguna fuente de URLs configurada. Define al menos siteUrl, staticDir, urlsFile o additionalUrls.',
    );
  }

  const entryLists = [];
  let crawlStats = null;

  if (config.crawl.enabled) {
    if (!config.crawl.startUrls || config.crawl.startUrls.length === 0) {
      if (config.siteUrl) {
        config.crawl.startUrls = [config.siteUrl];
      }
    }
    if (config.crawl.startUrls && config.crawl.startUrls.length > 0) {
      logger.info(`Crawling from: ${config.crawl.startUrls.join(', ')}`);
      const crawled = await crawlSite({ ...config.crawl, logger });
      crawlStats = crawled.stats;
      logger.info(`Crawl found ${crawled.entries.length} URL(s). Visited: ${crawlStats.visited}, broken links: ${crawlStats.brokenLinks.length}.`);
      entryLists.push(crawled.entries);
    }
  }

  if (config.staticDir) {
    if (!config.siteUrl) throw new Error('config.siteUrl is required when using staticDir.');
    const staticEntries = fromStaticDir(config.staticDir, config.siteUrl);
    logger.info(`Static dir scan found ${staticEntries.length} file(s).`);
    entryLists.push(staticEntries);
  }

  if (config.urlsFile) {
    const fileEntries = fromUrlsFile(config.urlsFile);
    logger.info(`Loaded ${fileEntries.length} URL(s) from ${config.urlsFile}.`);
    entryLists.push(fileEntries);
  }

  if (config.additionalUrls?.length) {
    entryLists.push(config.additionalUrls.map((u) => (typeof u === 'string' ? { loc: u } : u)));
  }

  let entries = dedupeEntries(entryLists);
  entries = applyRulesAndDefaults(entries, config);

  if (entries.length === 0) {
    logger.warn('No URLs collected — nothing to write.');
  }

  const chunks = splitEntries(entries, {
    maxUrlsPerFile: config.maxUrlsPerFile,
    maxBytesPerFile: config.maxBytesPerFile,
  });

  const outFile = path.resolve(config.outFile);
  const outDir = path.dirname(outFile);
  const ext = path.extname(outFile) || '.xml';
  const base = path.basename(outFile, ext);

  if (!config.dryRun) fs.mkdirSync(outDir, { recursive: true });

  const writtenFiles = [];

  function writeFile(fileName, xml) {
    const fullPath = path.join(outDir, fileName);
    if (!config.dryRun) {
      fs.writeFileSync(fullPath, xml, 'utf8');
      if (config.gzip) fs.writeFileSync(fullPath + '.gz', gzip(Buffer.from(xml, 'utf8')));
    }
    writtenFiles.push(fullPath);
    return fullPath;
  }

  let sitemapUrlForRobots = null;

  if (chunks.length <= 1) {
    const xml = buildUrlsetXml(chunks[0] || []);
    const fileName = `${base}${ext}`;
    writeFile(fileName, xml);
    sitemapUrlForRobots = buildPublicUrl(fileName, config);
    logger.info(`Wrote ${fileName} with ${(chunks[0] || []).length} URL(s).`);
  } else {
    const partMeta = [];
    chunks.forEach((chunk, i) => {
      const fileName = `${base}-${i + 1}${ext}`;
      const xml = buildUrlsetXml(chunk);
      writeFile(fileName, xml);
      partMeta.push({ loc: buildPublicUrl(fileName, config), lastmod: new Date().toISOString() });
      logger.info(`Wrote ${fileName} with ${chunk.length} URL(s).`);
    });

    const indexXml = buildSitemapIndexXml(partMeta);
    const indexFileName = `${base}${ext}`;
    writeFile(indexFileName, indexXml);
    sitemapUrlForRobots = buildPublicUrl(indexFileName, config);
    logger.info(`Wrote ${indexFileName} as sitemap index (${chunks.length} part files).`);
  }

  if (config.txtSitemap) {
    const txt = buildTxtSitemap(entries);
    const txtFileName = `${base}.txt`;
    if (!config.dryRun) fs.writeFileSync(path.join(outDir, txtFileName), txt, 'utf8');
    writtenFiles.push(path.join(outDir, txtFileName));
    logger.info(`Wrote ${txtFileName} (plain text sitemap).`);
  }

  let report = null;
  if (config.report) {
    report = {
      generatedAt: new Date().toISOString(),
      siteUrl: config.siteUrl,
      entryCount: entries.length,
      files: writtenFiles.map((f) => path.basename(f)),
      crawl: crawlStats
        ? {
          visited: crawlStats.visited,
          excludedByRobots: crawlStats.excludedByRobots,
          excludedByNoindex: crawlStats.excludedByNoindex,
          brokenLinks: crawlStats.brokenLinks,
        }
        : null,
    };
    if (!config.dryRun) {
      const reportPath = path.join(outDir, `${base}-report.json`);
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
      writtenFiles.push(reportPath);
      logger.info(`Wrote ${path.basename(reportPath)} with crawl diagnostics.`);
      if (report.crawl?.brokenLinks.length) {
        logger.warn(`${report.crawl.brokenLinks.length} broken link(s) found during crawl — see the report for details.`);
      }
    }
  }

  if (config.updateRobotsTxt && !config.dryRun) {
    const robotsPath = config.robotsTxtFile || path.join(outDir, 'robots.txt');
    if (!sitemapUrlForRobots || !/^https?:/i.test(sitemapUrlForRobots)) {
      logger.warn('Cannot update robots.txt: sitemap URL is not absolute (set siteUrl or sitemapsHost).');
    } else {
      const result = ensureSitemapReference(robotsPath, sitemapUrlForRobots);
      if (result.changed) logger.info(`Updated ${robotsPath} with Sitemap reference.`);
    }
  }

  if (config.ping.enabled && !config.dryRun && sitemapUrlForRobots) {
    await pingSearchEngines(sitemapUrlForRobots, config.ping.engines, logger);
  }

  if (config.indexNow.enabled && !config.dryRun) {
    await submitIndexNow(
      entries.map((e) => e.loc),
      config.indexNow,
      logger,
    );
  }

  const elapsedMs = Date.now() - startedAt;
  logger.info(`Done in ${elapsedMs}ms.`);

  return {
    entryCount: entries.length,
    files: writtenFiles,
    sitemapUrl: sitemapUrlForRobots,
    report,
    elapsedMs,
  };
}

module.exports = { generateSitemap, defineConfig, loadConfig };
