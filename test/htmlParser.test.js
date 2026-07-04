'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseHtml } = require('../src/htmlParser');

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
