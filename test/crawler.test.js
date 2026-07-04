'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeUrl, hasExcludedExtension, matchesAnyPattern } = require('../src/crawler');

test('normalizeUrl strips hash by default', () => {
  assert.equal(normalizeUrl('https://example.com/page#section'), 'https://example.com/page');
});

test('normalizeUrl can strip querystring', () => {
  const url = normalizeUrl('https://example.com/page?foo=bar', { stripQuerystring: true });
  assert.equal(url, 'https://example.com/page');
});

test('normalizeUrl keeps querystring when not stripped', () => {
  const url = normalizeUrl('https://example.com/page?foo=bar', { stripQuerystring: false });
  assert.equal(url, 'https://example.com/page?foo=bar');
});

test('hasExcludedExtension detects binary assets', () => {
  assert.equal(hasExcludedExtension('/image.PNG', ['.png']), true);
  assert.equal(hasExcludedExtension('/page.html', ['.png']), false);
});

test('matchesAnyPattern supports strings and RegExp', () => {
  assert.equal(matchesAnyPattern('https://example.com/admin/x', ['/admin/']), true);
  assert.equal(matchesAnyPattern('https://example.com/x', [/\/admin\//]), false);
});
