#!/usr/bin/env node
'use strict';

const { parseArgs } = require('node:util');
const path = require('node:path');
const { generateSitemap } = require('./index');
const pkg = require('../package.json');

const HELP = `
sitemap-generator - genera y auto-actualiza un sitemap.xml escaneando tu sitio

Uso:
  sitemap-generator --site <url> [opciones]
  sitemap-generator --config <archivo>

Opciones:
  --config <path>         Archivo de configuracion (.js o .json)
  --site <url>            URL raiz del sitio a escanear (siteUrl)
  --out <path>            Ruta de salida del sitemap (default: ./sitemap.xml)
  --static-dir <path>      Escanear un directorio local de HTML en vez de/ademas de crawlear
  --urls-file <path>       Fusionar URLs manuales desde un archivo .txt o .json
  --max-depth <n>          Profundidad maxima de crawling
  --max-urls <n>           Maximo de URLs a incluir
  --concurrency <n>        Peticiones concurrentes (default: 5)
  --gzip                   Tambien escribir una version .gz de cada archivo
  --txt-sitemap             Tambien escribir un sitemap.txt (una URL por linea)
  --no-report               No escribir el archivo *-report.json con diagnostico del crawl
  --update-robots-txt      Agregar/actualizar la linea Sitemap: en robots.txt
  --robots-txt-file <path> Ruta del robots.txt a actualizar
  --ping                   Notificar a los motores de busqueda tras generar
  --no-crawl               Desactivar el crawling (usar solo static-dir/urls-file)
  --dry-run                Ejecutar sin escribir archivos
  --verbose, -v            Logging detallado
  --version                Mostrar version
  --help, -h                Mostrar esta ayuda
`;

function toNumberOrInfinity(v) {
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : Infinity;
}

function main(argv) {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: {
        config: { type: 'string' },
        site: { type: 'string' },
        out: { type: 'string' },
        'static-dir': { type: 'string' },
        'urls-file': { type: 'string' },
        'max-depth': { type: 'string' },
        'max-urls': { type: 'string' },
        concurrency: { type: 'string' },
        gzip: { type: 'boolean' },
        'txt-sitemap': { type: 'boolean' },
        report: { type: 'boolean', default: true },
        'no-report': { type: 'boolean' },
        'update-robots-txt': { type: 'boolean' },
        'robots-txt-file': { type: 'string' },
        ping: { type: 'boolean' },
        crawl: { type: 'boolean', default: true },
        'no-crawl': { type: 'boolean' },
        'dry-run': { type: 'boolean' },
        verbose: { type: 'boolean', short: 'v' },
        version: { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
      },
      allowPositionals: false,
    }));
  } catch (err) {
    console.error(`Argumento invalido: ${err.message}`);
    console.log(HELP);
    process.exitCode = 1;
    return;
  }

  if (values.help) {
    console.log(HELP);
    return;
  }
  if (values.version) {
    console.log(pkg.version);
    return;
  }

  const overrides = {};
  if (values.site) overrides.siteUrl = values.site;
  if (values.out) overrides.outFile = values.out;
  if (values['static-dir']) overrides.staticDir = values['static-dir'];
  if (values['urls-file']) overrides.urlsFile = values['urls-file'];
  if (values.gzip) overrides.gzip = true;
  if (values['txt-sitemap']) overrides.txtSitemap = true;
  if (values['no-report']) overrides.report = false;
  if (values['update-robots-txt']) overrides.updateRobotsTxt = true;
  if (values['robots-txt-file']) overrides.robotsTxtFile = values['robots-txt-file'];
  if (values['dry-run']) overrides.dryRun = true;
  if (values.verbose) overrides.verbose = true;
  if (values.ping) overrides.ping = { enabled: true, engines: ['bing'] };

  const crawlOverrides = {};
  if (values['max-depth'] !== undefined) crawlOverrides.maxDepth = toNumberOrInfinity(values['max-depth']);
  if (values['max-urls'] !== undefined) crawlOverrides.maxUrls = toNumberOrInfinity(values['max-urls']);
  if (values.concurrency !== undefined) crawlOverrides.concurrency = Number(values.concurrency);
  if (values['no-crawl']) crawlOverrides.enabled = false;
  if (Object.keys(crawlOverrides).length > 0) overrides.crawl = crawlOverrides;

  const configPath = values.config ? path.resolve(values.config) : null;

  generateSitemap(configPath, overrides)
    .then((result) => {
      console.log(`\nURLs: ${result.entryCount} | Archivos: ${result.files.length} | Tiempo: ${result.elapsedMs}ms`);
      for (const f of result.files) console.log(` - ${f}`);
    })
    .catch((err) => {
      console.error('Error generando el sitemap:', err.message);
      if (values.verbose) console.error(err.stack);
      process.exitCode = 1;
    });
}

main(process.argv.slice(2));

module.exports = { main };
