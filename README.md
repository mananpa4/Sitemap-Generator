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
- **Analisis SEO on-page nativo** (`seo.enabled: true` / `--seo`): sobre cada
  URL crawleada revisa longitud de title/meta description, un solo `<h1>`,
  cobertura de `alt` en imagenes, conteo de palabras, legibilidad (Flesch
  reading ease), enlaces internos/externos, y — si defines
  `focusKeyword`/`--focus-keyword` — presencia y densidad de la palabra clave.
  Tambien detecta titles/descriptions duplicados entre paginas del sitio.
  Escribe `*-seo-report.json`. Es una heuristica propia, ligera y sin
  dependencias (no un port de Yoast SEO ni de ninguna libreria externa — ver
  la seccion "Analisis SEO" mas abajo).

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

console.log(result); // { entryCount, files, sitemapUrl, report, seoReport, elapsedMs }
```

## Fuentes de URLs, combinadas

Puedes usar una o varias fuentes a la vez; se fusionan por URL (dedupe):

| Fuente | Config | Cuando usarla |
|---|---|---|
| Crawl HTTP | `siteUrl` / `crawl.startUrls` | Sitio en produccion, quieres que se descubra solo |
| Directorio estatico | `staticDir` | Sitio generado estaticamente (build de un SSG), sin necesidad de HTTP |
| Lista manual | `urlsFile` | URLs que el crawler no puede descubrir (paginas huerfanas, etc.) |
| Inline | `additionalUrls` | Un puñado de URLs fijas dentro del propio config |

## Analisis SEO

```bash
node bin/sitemap-generator.js --site https://example.com --seo --focus-keyword "zapatos para correr"
```

Por cada URL que el crawler visita y parsea como HTML, se ejecutan estos
checks (cada uno con rating `good`/`ok`/`bad` y un mensaje):

| Check | Que mide | Default |
|---|---|---|
| `titleLength` | Longitud del `<title>` | 40-60 caracteres |
| `descriptionLength` | Longitud del meta description | 120-156 caracteres |
| `singleH1` | Exactamente un `<h1>` en la pagina | — |
| `imageAlt` | % de `<img>` con `alt` no vacio | >=90% good, >=50% ok |
| `wordCount` | Cantidad de palabras del texto visible | 300+ |
| `readability` | Flesch reading ease sobre el texto visible | >=60 good, >=30 ok |
| `internalLinks` / `externalLinks` | Al menos un enlace interno/externo | — |
| `keywordInTitle` / `keywordInDescription` / `keywordDensity` | Solo si defines `focusKeyword` | densidad 0.5%-2.5% |

Ademas, a nivel de sitio completo se detectan **titles y meta descriptions
duplicados** entre distintas paginas (`duplicateTitles`/`duplicateDescriptions`
en el reporte).

Todo esto se implemento **desde cero, en JS plano** (`src/seoAnalysis.js` +
las extensiones de `src/htmlParser.js`), sin agregar ninguna dependencia de
produccion — es un heuristico propio de esta herramienta, inspirado en el
tipo de checks que hace Yoast SEO, pero no un port de su algoritmo ni de su
escala de puntaje. Si tu proyecto necesita un analisis de contenido mas
fino (idiomas con reglas linguisticas propias, voz pasiva, palabras de
transicion, etc.), considera usar la libreria `yoastseo` directamente en tu
capa de edicion de contenido (ver `repos/repos-SEO/Laravel-YoastSeo-master`
para un ejemplo de integracion en Vue/Laravel) en vez de aqui, para mantener
este generador de sitemaps sin dependencias.

Deshabilitado por defecto (`seo.enabled: false`); actívalo con `--seo` o
`seo: { enabled: true }` en el config file.

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
  htmlParser.js              Extraccion de enlaces/meta/headings/imagenes sin dependencias
  sources.js                Fuentes alternativas: staticDir, urlsFile
  sitemapBuilder.js          Construccion de XML/TXT, split, sitemap index, gzip
  robotsTxtWriter.js         Actualiza robots.txt de forma no destructiva
  ping.js                    Ping a buscadores + IndexNow
  seoAnalysis.js             Checks SEO on-page nativos (title/description/H1/alt/legibilidad/keyword/duplicados)
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

Incluye tests unitarios (robots.txt, HTML parsing, sitemap builder, checks
SEO, helpers del crawler) y tests de integracion que levantan un servidor
HTTP local real y validan el flujo completo de crawl -> sitemap.xml ->
reporte (y crawl -> reporte SEO).

## Repos de referencia (`repos/`)

Carpeta con las herramientas que se revisaron para diseñar este proyecto
(no forman parte del build ni se ejecutan): crawlers standalone en PHP/Node/Go
(`Sitemap-Generator-Crawler-master`, `sitemap-generator-master`,
`go-sitemap-generator-master`), generadores orientados a framework
(`next-sitemap-master`, `super-sitemap-main`, `php-sitemap-master`,
`sitemap_generator-master` para Ruby/Rails, `sitemap.js-master`), una GUI
de escritorio (`siteone-crawler-gui-master`) cuyo aporte conceptual (reporte
de resultados del crawl, sitemap en TXT) se incorporo a esta herramienta, y
en `repos/repos-SEO/` dos proyectos de analisis de contenido SEO
(`Laravel-YoastSeo-master`, una demo Vue/Laravel que consume la libreria
`yoastseo`, actualizada aqui de la version `1.57.0` a `3.6.0`; y
`yoastseo-279`, el dump completo del plugin WordPress SEO de Yoast v27.9,
usado como referencia de que checks existen en la version actual de Yoast al
diseñar `src/seoAnalysis.js`).

## Notas y limitaciones conocidas

- El crawler solo sigue enlaces `<a href>` en HTML servido por el propio
  servidor (no ejecuta JavaScript). Para sitios SPA sin SSR, usa `staticDir`
  apuntando al build, o `urlsFile`/`additionalUrls`.
- Google ignora `changefreq`/`priority` para decidir cuando rastrear (usa sus
  propias heurísticas); se incluyen igual porque otros motores y crawlers los
  respetan.
- El ping directo a Google esta deprecado desde junio de 2023; usa Search
  Console/su API para notificarle explicitamente.
