<?php

/**
 * Feature tests for including all view templates in the sitemap package.
 */

defined('SITEMAP_TEST_INCLUDE') || define('SITEMAP_TEST_INCLUDE', true);

$viewDir = __DIR__ . '/../../src/views/';
$views = [
    'google-news.php',
    'html.php',
    'ror-rdf.php',
    'ror-rss.php',
    'sitemapindex.php',
    'txt.php',
    'xml-mobile.php',
    'xml.php',
];

test('all view templates can be included as PHP', function () use ($viewDir, $views) {
    foreach ($views as $file) {
        // Define variables expected by the views
        $style = null;
        $items = [];
        $channel = ['title' => '', 'link' => ''];
        $sitemaps = [];
        // The view may not use all of these, but this prevents undefined variable warnings
        $result = include $viewDir . $file;
        expect(true)->toBeTrue();
    }
});
