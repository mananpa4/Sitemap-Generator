# Sitemap Generator

Herramienta *all-in-one*, sin dependencias externas, para generar y
auto-actualizar un `sitemap.xml` escaneando un sitio web. Fusiona las mejores
ideas de varios generadores de sitemap de referencia (PHP, Node, Go, Ruby,
frameworks) en una sola herramienta de linea de comandos + libreria para
Node.js, pensada para ejecutarse manualmente o de forma programada (cron,
Task Scheduler, CI).

## Caracteristicas

- **Crawler propio** (sin dependencias): sigue enlaces del mismo origen,
  respeta `robots.txt` (Allow/Disallow/Crawl-delay), respeta
  `<meta name="robots">` (`noindex`/`nofollow`), usa `<link rel="canonical">`,
  ignora paginas AMP, filtra por extension y por patrones de exclusion
  configurables.
- **Fuentes alternativas de URLs**: escaneo de un directorio estatico local
  (`staticDir`), lista manual de URLs (`urlsFile`, `.txt`/`.json`) y URLs
  adicionales inline (`additionalUrls`) — todas se fusionan (dedupe por URL)
  con el resultado del crawl.
- **Sitemap XML completo**: `lastmod`, `changefreq`, `priority` (con
  `priorityMap` por profundidad y `perUrlRules` por patron), extensiones de
  imagenes/videos/Google News/`hreflang` cuando la entrada las incluye.
- **Sitemap index automatico**: si se superan 50.000 URLs o ~50MB por
  archivo (limites del protocolo de sitemaps), se generan `sitemap-1.xml`,
  `sitemap-2.xml`, ... y `sitemap.xml` pasa a ser el indice.
- **Salida adicional opcional**: `.xml.gz` (`gzip: true`), `sitemap.txt`
  (`txtSitemap: true`) y un reporte de diagnostico `*-report.json` (enlaces
  rotos encontrados, paginas excluidas por robots.txt/noindex, etc.).
- **`robots.txt` autogestionado**: agrega/actualiza la linea `Sitemap:` sin
  pisar el resto del archivo (`updateRobotsTxt: true`).
- **Notificacion a buscadores**: ping a Bing y soporte para
  [IndexNow](https://www.indexnow.org/) (Bing/Yandex/Seznam/Naver). Google
  retiro su endpoint de ping en junio de 2023 — para Google usar Search
  Console / su API de indexacion.
- **Config file + CLI + API programatica**: mismo motor desde `sitemap.config.js`,
  flags de linea de comandos, o `require('./src').generateSitemap(...)`.

## Requisitos

- Node.js >= 18.3 (usa `fetch` y `node:util.parseArgs` nativos). Probado con
  Node 24.

No hay `npm install` que correr: el proyecto no tiene dependencias de
produccion.

## Uso rapido (CLI)

```bash
# Escanear un sitio y generar ./sitemap.xml
node bin/sitemap-generator.js --site https://example.com

# Con opciones comunes
node bin/sitemap-generator.js --site https://example.com \
  --out ./public/sitemap.xml \
  --max-depth 6 --max-urls 20000 --concurrency 8 \
  --update-robots-txt --gzip --verbose

# Usando un archivo de configuracion (recomendado para uso recurrente)
node bin/sitemap-generator.js --config sitemap.config.js
```

Ver todas las opciones con `node bin/sitemap-generator.js --help`.

Copia [`examples/sitemap.config.example.js`](examples/sitemap.config.example.js)
a `sitemap.config.js` en la raiz del proyecto y ajustalo; ahi estan
documentadas todas las opciones (crawl, prioridades, robots.txt, ping,
IndexNow, etc.).

## Uso programatico (API)

```js
const { generateSitemap } = require('./src/index');

const result = await generateSitemap({
  siteUrl: 'https://example.com',
  outFile: './public/sitemap.xml',
  crawl: { maxDepth: 5, concurrency: 5 },
  updateRobotsTxt: true,
});

console.log(result); // { entryCount, files, sitemapUrl, report, elapsedMs }
```

## Fuentes de URLs, combinadas

Puedes usar una o varias fuentes a la vez; se fusionan por URL (dedupe):

| Fuente | Config | Cuando usarla |
|---|---|---|
| Crawl HTTP | `siteUrl` / `crawl.startUrls` | Sitio en produccion, quieres que se descubra solo |
| Directorio estatico | `staticDir` | Sitio generado estaticamente (build de un SSG), sin necesidad de HTTP |
| Lista manual | `urlsFile` | URLs que el crawler no puede descubrir (paginas huerfanas, etc.) |
| Inline | `additionalUrls` | Un puñado de URLs fijas dentro del propio config |

## Ejecucion periodica: cron o manual

Esta herramienta **no incluye un scheduler propio** — se ejecuta una vez por
invocacion y termina, exactamente para poder programarla con las
herramientas del sistema operativo (o CI), que son mas confiables que un
proceso Node de larga duracion:

- **Linux/macOS**: `crontab` — ver [`examples/cron/crontab.example`](examples/cron/crontab.example).
- **Windows**: Task Scheduler (`schtasks` o interfaz grafica) — ver
  [`examples/cron/windows-task-scheduler.md`](examples/cron/windows-task-scheduler.md).
- **CI/CD**: GitHub Actions con `schedule:` — ver
  [`examples/cron/github-actions.yml`](examples/cron/github-actions.yml).
- **Manual**: simplemente correr el comando CLI cuando haga falta.

Revisa siempre `*-report.json` despues de una corrida programada: ahi
aparecen los enlaces rotos y las exclusiones detectadas en ese crawl.

## Estructura del proyecto

```
bin/sitemap-generator.js   Entry point ejecutable (shebang)
src/
  cli.js                   Parseo de argumentos y punto de entrada CLI
  index.js                 Orquestador: generateSitemap() (API publica)
  config.js                Defaults, merge de config file + overrides, defineConfig()
  crawler.js                Crawler BFS con pool de concurrencia
  http.js                   Wrapper de fetch con timeout/retries
  robots.js                 Parser/evaluador de robots.txt
  htmlParser.js              Extraccion de enlaces/meta/canonical sin dependencias
  sources.js                Fuentes alternativas: staticDir, urlsFile
  sitemapBuilder.js          Construccion de XML/TXT, split, sitemap index, gzip
  robotsTxtWriter.js         Actualiza robots.txt de forma no destructiva
  ping.js                    Ping a buscadores + IndexNow
  logger.js                  Logger simple por niveles
examples/                  Config de ejemplo, lista de URLs, ejemplos de cron/CI
test/                       Tests con node:test (sin dependencias)
repos/                      Repos de referencia usados para el diseño (no se ejecutan)
```

## Tests

```bash
npm test
# equivalente a: node --test test/*.test.js
```

Incluye tests unitarios (robots.txt, HTML parsing, sitemap builder, helpers
del crawler) y un test de integracion que levanta un servidor HTTP local real
y valida el flujo completo de crawl -> sitemap.xml -> reporte.

## Repos de referencia (`repos/`)

Carpeta con las herramientas que se revisaron para diseñar este proyecto
(no forman parte del build ni se ejecutan): crawlers standalone en PHP/Node/Go
(`Sitemap-Generator-Crawler-master`, `sitemap-generator-master`,
`go-sitemap-generator-master`), generadores orientados a framework
(`next-sitemap-master`, `super-sitemap-main`, `php-sitemap-master`,
`sitemap_generator-master` para Ruby/Rails, `sitemap.js-master`), y una GUI
de escritorio (`siteone-crawler-gui-master`) cuyo aporte conceptual (reporte
de resultados del crawl, sitemap en TXT) se incorporo a esta herramienta.

## Notas y limitaciones conocidas

- El crawler solo sigue enlaces `<a href>` en HTML servido por el propio
  servidor (no ejecuta JavaScript). Para sitios SPA sin SSR, usa `staticDir`
  apuntando al build, o `urlsFile`/`additionalUrls`.
- Google ignora `changefreq`/`priority` para decidir cuando rastrear (usa sus
  propias heurísticas); se incluyen igual porque otros motores y crawlers los
  respetan.
- El ping directo a Google esta deprecado desde junio de 2023; usa Search
  Console/su API para notificarle explicitamente.
