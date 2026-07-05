'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseHtml, stripHtmlToText } = require('../src/htmlParser');

test('extracts links regardless of attribute order', () => {
  const html = `
    <a href="/one">One</a>
    <a class="btn" href="/two" rel="nofollow">Two</a>
    <a rel="noopener" href='/three'>Three</a>
  `;
  const { links } = parseHtml(html);
  assert.equal(links.length, 3);
  assert.equal(links[0].href, '/one');
  assert.equal(links[1].rel, 'nofollow');
  assert.equal(links[2].href, '/three');
});

test('extracts meta robots content', () => {
  const html = '<meta content="noindex,nofollow" name="robots">';
  const { metaRobots } = parseHtml(html);
  assert.equal(metaRobots, 'noindex,nofollow');
});

test('extracts canonical link', () => {
  const html = '<link rel="canonical" href="https://example.com/canonical-page">';
  const { canonical } = parseHtml(html);
  assert.equal(canonical, 'https://example.com/canonical-page');
});

test('extracts base href and title', () => {
  const html = '<base href="/sub/"><title> My Page </title>';
  const { base, title } = parseHtml(html);
  assert.equal(base, '/sub/');
  assert.equal(title, 'My Page');
});

test('extracts meta description', () => {
  const html = '<meta name="description" content="A great page about cats.">';
  const { metaDescription } = parseHtml(html);
  assert.equal(metaDescription, 'A great page about cats.');
});

test('extracts headings by level, ignoring nested markup', () => {
  const html = '<h1>Main <b>Title</b></h1><h2>Sub one</h2><h2>Sub two</h2>';
  const { headings } = parseHtml(html);
  assert.deepEqual(headings.h1, ['Main Title']);
  assert.deepEqual(headings.h2, ['Sub one', 'Sub two']);
  assert.deepEqual(headings.h3, []);
});

test('extracts images with src and alt', () => {
  const html = '<img src="/a.png" alt="A cat"><img src="/b.png">';
  const { images } = parseHtml(html);
  assert.equal(images.length, 2);
  assert.deepEqual(images[0], { src: '/a.png', alt: 'A cat' });
  assert.deepEqual(images[1], { src: '/b.png', alt: '' });
});

test('stripHtmlToText removes scripts/styles/tags and collapses whitespace', () => {
  const html = '<html><head><style>.a{color:red}</style></head><body><script>evil()</script><p>Hello   <b>world</b>!</p></body></html>';
  assert.equal(stripHtmlToText(html), 'Hello world !');
});
