'use strict';

/**
 * Lightweight, dependency-free on-page SEO checks, inspired by the kind of
 * assessments Yoast SEO runs (title/description length, single H1, image
 * alt coverage, keyword usage, readability, internal/external links) but
 * reimplemented natively to keep this project's zero-dependency policy.
 * This is a heuristic, English-oriented approximation — not a port of any
 * specific analysis library's algorithm or scoring scale.
 */

const RATING = { GOOD: 'good', OK: 'ok', BAD: 'bad' };

function countWords(text) {
  if (!text) return 0;
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length;
}

/**
 * Classic heuristic vowel-group syllable counter (the same general
 * approach used by most lightweight English readability tools): count
 * groups of vowels, drop a trailing silent "e", and clamp to at least 1.
 */
function countSyllables(word) {
  const clean = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!clean) return 0;
  if (clean.length <= 3) return 1;

  let working = clean.replace(/e$/, '');
  const matches = working.match(/[aeiouy]+/g);
  return matches ? matches.length : 1;
}

/**
 * Flesch Reading Ease score (0-100, higher = easier to read). Standard
 * formula; sentence/word/syllable counts are approximated with simple
 * regex splitting rather than full NLP.
 */
function fleschReadingEase(text) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const sentences = text.split(/[.!?]+(?:\s|$)/).map((s) => s.trim()).filter(Boolean);

  if (words.length === 0 || sentences.length === 0) return null;

  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const score = 206.835 - 1.015 * (words.length / sentences.length) - 84.6 * (syllables / words.length);
  return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
}

function check(id, rating, message) {
  return { id, rating, message };
}

function rangeRating(value, { min, max }, { softMargin = 0 } = {}) {
  if (value >= min && value <= max) return RATING.GOOD;
  if (value >= min - softMargin && value <= max + softMargin) return RATING.OK;
  return RATING.BAD;
}

function countOccurrences(text, phrase) {
  if (!phrase) return 0;
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(escaped, 'gi');
  const matches = text.match(re);
  return matches ? matches.length : 0;
}

/**
 * @param {object} page raw facts collected during the crawl
 * @param {string} page.url
 * @param {string|null} page.title
 * @param {string|null} page.metaDescription
 * @param {Record<string,string[]>} page.headings
 * @param {Array<{src:string, alt:string}>} page.images
 * @param {string} page.text visible text content
 * @param {number} page.internalLinksCount
 * @param {number} page.externalLinksCount
 * @param {object} options
 * @param {string|null} [options.focusKeyword]
 * @param {{min:number,max:number}} [options.titleLength]
 * @param {{min:number,max:number}} [options.descriptionLength]
 * @param {number} [options.minWordCount]
 */
function analyzePage(page, options = {}) {
  const {
    focusKeyword = null,
    titleLength = { min: 40, max: 60 },
    descriptionLength = { min: 120, max: 156 },
    minWordCount = 300,
  } = options;

  const checks = [];
  const title = page.title || '';
  const description = page.metaDescription || '';
  const wordCount = page.wordCount ?? countWords(page.text || '');

  if (!title) {
    checks.push(check('titleLength', RATING.BAD, 'Missing <title>.'));
  } else {
    const rating = rangeRating(title.length, titleLength, { softMargin: 10 });
    checks.push(check('titleLength', rating, `Title is ${title.length} characters (recommended ${titleLength.min}-${titleLength.max}).`));
  }

  if (!description) {
    checks.push(check('descriptionLength', RATING.BAD, 'Missing meta description.'));
  } else {
    const rating = rangeRating(description.length, descriptionLength, { softMargin: 40 });
    checks.push(check('descriptionLength', rating, `Meta description is ${description.length} characters (recommended ${descriptionLength.min}-${descriptionLength.max}).`));
  }

  const h1Count = page.headings?.h1?.length || 0;
  if (h1Count === 1) {
    checks.push(check('singleH1', RATING.GOOD, 'Exactly one H1 heading.'));
  } else if (h1Count === 0) {
    checks.push(check('singleH1', RATING.BAD, 'No H1 heading found.'));
  } else {
    checks.push(check('singleH1', RATING.BAD, `${h1Count} H1 headings found; use only one.`));
  }

  const images = page.images || [];
  if (images.length === 0) {
    checks.push(check('imageAlt', RATING.GOOD, 'No images on this page.'));
  } else {
    const withAlt = images.filter((img) => img.alt && img.alt.trim()).length;
    const ratio = withAlt / images.length;
    const rating = ratio >= 0.9 ? RATING.GOOD : ratio >= 0.5 ? RATING.OK : RATING.BAD;
    checks.push(check('imageAlt', rating, `${withAlt}/${images.length} images have alt text.`));
  }

  const wordRating = wordCount >= minWordCount ? RATING.GOOD : wordCount >= minWordCount / 2 ? RATING.OK : RATING.BAD;
  checks.push(check('wordCount', wordRating, `Text contains ${wordCount} words (recommended ${minWordCount}+).`));

  const readability = fleschReadingEase(page.text || '');
  if (readability !== null) {
    const rating = readability >= 60 ? RATING.GOOD : readability >= 30 ? RATING.OK : RATING.BAD;
    checks.push(check('readability', rating, `Flesch reading ease score: ${readability}.`));
  }

  const internalLinks = page.internalLinksCount ?? 0;
  checks.push(check('internalLinks', internalLinks > 0 ? RATING.GOOD : RATING.BAD, `${internalLinks} internal link(s).`));

  const externalLinks = page.externalLinksCount ?? 0;
  checks.push(check('externalLinks', externalLinks > 0 ? RATING.GOOD : RATING.BAD, `${externalLinks} external link(s).`));

  if (focusKeyword) {
    const inTitle = title.toLowerCase().includes(focusKeyword.toLowerCase());
    checks.push(check('keywordInTitle', inTitle ? RATING.GOOD : RATING.BAD, inTitle ? 'Focus keyword found in title.' : 'Focus keyword missing from title.'));

    const inDescription = description.toLowerCase().includes(focusKeyword.toLowerCase());
    checks.push(check('keywordInDescription', inDescription ? RATING.GOOD : RATING.BAD, inDescription ? 'Focus keyword found in meta description.' : 'Focus keyword missing from meta description.'));

    if (wordCount > 0) {
      const occurrences = countOccurrences(page.text || '', focusKeyword);
      const density = (occurrences / wordCount) * 100;
      const rating = density >= 0.5 && density <= 2.5 ? RATING.GOOD : RATING.OK;
      checks.push(check('keywordDensity', density === 0 ? RATING.BAD : rating, `Focus keyword density: ${Math.round(density * 100) / 100}% (${occurrences} occurrence(s)).`));
    }
  }

  const score = computeScore(checks);
  return { url: page.url, score, checks };
}

function computeScore(checks) {
  if (checks.length === 0) return null;
  const weight = { good: 1, ok: 0.5, bad: 0 };
  const total = checks.reduce((sum, c) => sum + weight[c.rating], 0);
  return Math.round((total / checks.length) * 100);
}

/** Groups pages that share the same (non-empty) title or meta description — a common duplicate-content signal. */
function findDuplicates(pages) {
  const byTitle = new Map();
  const byDescription = new Map();

  for (const page of pages) {
    if (page.title) {
      const key = page.title.trim().toLowerCase();
      if (!byTitle.has(key)) byTitle.set(key, []);
      byTitle.get(key).push(page.url);
    }
    if (page.metaDescription) {
      const key = page.metaDescription.trim().toLowerCase();
      if (!byDescription.has(key)) byDescription.set(key, []);
      byDescription.get(key).push(page.url);
    }
  }

  const duplicateTitles = Array.from(byTitle.values()).filter((urls) => urls.length > 1);
  const duplicateDescriptions = Array.from(byDescription.values()).filter((urls) => urls.length > 1);

  return { duplicateTitles, duplicateDescriptions };
}

function analyzeSite(pages, options = {}) {
  const analyzed = pages.map((page) => analyzePage(page, options));
  const { duplicateTitles, duplicateDescriptions } = findDuplicates(pages);

  const scores = analyzed.map((p) => p.score).filter((s) => s !== null);
  const averageScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  return {
    focusKeyword: options.focusKeyword || null,
    averageScore,
    pages: analyzed,
    duplicateTitles,
    duplicateDescriptions,
  };
}

module.exports = {
  countWords,
  countSyllables,
  fleschReadingEase,
  analyzePage,
  findDuplicates,
  analyzeSite,
  RATING,
};
