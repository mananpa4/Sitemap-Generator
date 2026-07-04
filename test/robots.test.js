'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { RobotsTxt } = require('../src/robots');

test('allows everything when robots.txt is empty', () => {
  const robots = new RobotsTxt('');
  assert.equal(robots.isAllowed('/anything'), true);
});

test('respects Disallow for matching user-agent group', () => {
  const robots = new RobotsTxt(`
User-agent: *
Disallow: /admin/
Disallow: /private
`);
  assert.equal(robots.isAllowed('/admin/dashboard'), false);
  assert.equal(robots.isAllowed('/private'), false);
  assert.equal(robots.isAllowed('/public'), true);
});

test('longest match wins between Allow and Disallow', () => {
  const robots = new RobotsTxt(`
User-agent: *
Disallow: /shop
Allow: /shop/public
`);
  assert.equal(robots.isAllowed('/shop/secret'), false);
  assert.equal(robots.isAllowed('/shop/public/page'), true);
});

test('wildcard and end anchor patterns', () => {
  const robots = new RobotsTxt(`
User-agent: *
Disallow: /*.pdf$
`);
  assert.equal(robots.isAllowed('/doc.pdf'), false);
  assert.equal(robots.isAllowed('/doc.pdf?x=1'), true);
});

test('picks specific user-agent group over wildcard', () => {
  const robots = new RobotsTxt(`
User-agent: *
Disallow: /

User-agent: SitemapGeneratorBot
Allow: /
`);
  assert.equal(robots.isAllowed('/foo', 'SitemapGeneratorBot'), true);
  assert.equal(robots.isAllowed('/foo', 'OtherBot'), false);
});

test('parses sitemap directives', () => {
  const robots = new RobotsTxt('Sitemap: https://example.com/sitemap.xml');
  assert.deepEqual(robots.sitemaps, ['https://example.com/sitemap.xml']);
});
