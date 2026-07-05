'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  countWords,
  countSyllables,
  fleschReadingEase,
  analyzePage,
  findDuplicates,
  analyzeSite,
} = require('../src/seoAnalysis');

test('countWords counts whitespace-separated words', () => {
  assert.equal(countWords('one two   three'), 3);
  assert.equal(countWords(''), 0);
  assert.equal(countWords(null), 0);
});

test('countSyllables gives sane counts for common words', () => {
  assert.equal(countSyllables('cat'), 1);
  assert.equal(countSyllables('happy'), 2);
  assert.equal(countSyllables('beautiful'), 3);
});

test('fleschReadingEase returns higher scores for simpler text', () => {
  const simple = 'The cat sat on the mat. It was a good day.';
  const complex = 'The multifaceted implementation necessitates comprehensive consideration of interdependent architectural ramifications.';
  const simpleScore = fleschReadingEase(simple);
  const complexScore = fleschReadingEase(complex);
  assert.ok(simpleScore > complexScore, `expected ${simpleScore} > ${complexScore}`);
});

test('fleschReadingEase returns null for empty text', () => {
  assert.equal(fleschReadingEase(''), null);
});

test('analyzePage flags a missing title and meta description as bad', () => {
  const result = analyzePage({
    url: 'https://example.com/',
    title: '',
    metaDescription: '',
    headings: { h1: [] },
    images: [],
    text: 'short text',
    internalLinksCount: 0,
    externalLinksCount: 0,
  });

  const titleCheck = result.checks.find((c) => c.id === 'titleLength');
  const descCheck = result.checks.find((c) => c.id === 'descriptionLength');
  assert.equal(titleCheck.rating, 'bad');
  assert.equal(descCheck.rating, 'bad');
});

test('analyzePage rates a well-formed page as good on structural checks', () => {
  const title = 'A'.repeat(50); // within 40-60 default range
  const description = 'B'.repeat(140); // within 120-156 default range
  const longText = 'Simple words make simple sentences that are easy to read. '.repeat(60);

  const result = analyzePage({
    url: 'https://example.com/page',
    title,
    metaDescription: description,
    headings: { h1: ['Only heading'] },
    images: [{ src: '/a.png', alt: 'Alt text' }],
    text: longText,
    internalLinksCount: 2,
    externalLinksCount: 1,
  });

  const byId = Object.fromEntries(result.checks.map((c) => [c.id, c.rating]));
  assert.equal(byId.titleLength, 'good');
  assert.equal(byId.descriptionLength, 'good');
  assert.equal(byId.singleH1, 'good');
  assert.equal(byId.imageAlt, 'good');
  assert.equal(byId.internalLinks, 'good');
  assert.equal(byId.externalLinks, 'good');
  assert.equal(typeof result.score, 'number');
});

test('analyzePage adds keyword checks only when a focus keyword is given', () => {
  const withoutKeyword = analyzePage({ url: 'https://example.com/', title: 't', metaDescription: 'd', headings: {}, images: [], text: 'hello world' });
  assert.ok(!withoutKeyword.checks.some((c) => c.id === 'keywordInTitle'));

  const withKeyword = analyzePage(
    { url: 'https://example.com/', title: 'All about cats', metaDescription: 'Learn about cats here', headings: {}, images: [], text: 'Cats are great. Cats are fun.' },
    { focusKeyword: 'cats' },
  );
  const inTitle = withKeyword.checks.find((c) => c.id === 'keywordInTitle');
  const inDescription = withKeyword.checks.find((c) => c.id === 'keywordInDescription');
  assert.equal(inTitle.rating, 'good');
  assert.equal(inDescription.rating, 'good');
});

test('findDuplicates groups pages sharing the same title or description', () => {
  const pages = [
    { url: 'https://example.com/a', title: 'Same Title', metaDescription: 'Desc A' },
    { url: 'https://example.com/b', title: 'Same Title', metaDescription: 'Desc B' },
    { url: 'https://example.com/c', title: 'Different', metaDescription: 'Desc A' },
  ];
  const { duplicateTitles, duplicateDescriptions } = findDuplicates(pages);
  assert.equal(duplicateTitles.length, 1);
  assert.deepEqual(duplicateTitles[0].sort(), ['https://example.com/a', 'https://example.com/b']);
  assert.equal(duplicateDescriptions.length, 1);
  assert.deepEqual(duplicateDescriptions[0].sort(), ['https://example.com/a', 'https://example.com/c']);
});

test('analyzeSite aggregates per-page results and an average score', () => {
  const pages = [
    { url: 'https://example.com/a', title: 'A'.repeat(50), metaDescription: 'B'.repeat(140), headings: { h1: ['H'] }, images: [], text: 'word '.repeat(310), internalLinksCount: 1, externalLinksCount: 1 },
    { url: 'https://example.com/b', title: '', metaDescription: '', headings: { h1: [] }, images: [], text: '', internalLinksCount: 0, externalLinksCount: 0 },
  ];
  const report = analyzeSite(pages);
  assert.equal(report.pages.length, 2);
  assert.ok(report.averageScore >= 0 && report.averageScore <= 100);
});
