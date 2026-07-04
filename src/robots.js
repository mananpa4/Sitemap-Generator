'use strict';

/**
 * Small robots.txt parser/evaluator (no dependency).
 * Supports groups per user-agent, Allow/Disallow with `*` and `$`,
 * and Crawl-delay. Longest-match wins; on a tie Allow wins (Google's rule).
 */

function patternToRegExp(pattern) {
  let endsWith$ = pattern.endsWith('$');
  let p = endsWith$ ? pattern.slice(0, -1) : pattern;
  // Escape regex special chars except '*' which we treat as wildcard.
  p = p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp('^' + p + (endsWith$ ? '$' : ''));
}

class RobotsTxt {
  constructor(content = '') {
    this.groups = []; // { agents: [], rules: [{type, pattern, regex}], crawlDelay }
    this.sitemaps = [];
    this._parse(content);
  }

  _parse(content) {
    const lines = content.split(/\r?\n/);
    let currentGroup = null;
    // A run of consecutive User-agent lines forms one group. Once a rule
    // (Allow/Disallow/etc.) has been seen, the next User-agent line starts
    // a brand new group rather than extending the current one.
    let sawRuleSinceGroupStart = true;

    for (const rawLine of lines) {
      const line = rawLine.replace(/#.*$/, '').trim();
      if (!line) continue;

      const idx = line.indexOf(':');
      if (idx === -1) continue;

      const field = line.slice(0, idx).trim().toLowerCase();
      const value = line.slice(idx + 1).trim();

      if (field === 'user-agent') {
        if (!currentGroup || sawRuleSinceGroupStart) {
          currentGroup = { agents: [], rules: [], crawlDelay: null };
          this.groups.push(currentGroup);
          sawRuleSinceGroupStart = false;
        }
        currentGroup.agents.push(value.toLowerCase());
      } else if (field === 'disallow' || field === 'allow') {
        if (!currentGroup) continue;
        sawRuleSinceGroupStart = true;
        if (value === '' && field === 'disallow') {
          // Empty Disallow means "allow everything" per spec.
          continue;
        }
        currentGroup.rules.push({
          type: field,
          pattern: value,
          regex: patternToRegExp(value),
          length: value.length,
        });
      } else if (field === 'crawl-delay') {
        if (currentGroup) {
          currentGroup.crawlDelay = parseFloat(value) || null;
          sawRuleSinceGroupStart = true;
        }
      } else if (field === 'sitemap') {
        this.sitemaps.push(value);
      }
    }
  }

  _matchGroup(userAgent) {
    const ua = userAgent.toLowerCase();
    let specific = null;
    let wildcard = null;
    for (const group of this.groups) {
      for (const agent of group.agents) {
        if (agent === '*') wildcard = wildcard || group;
        else if (ua.includes(agent)) specific = group;
      }
    }
    return specific || wildcard || null;
  }

  /**
   * @param {string} pathWithQuery e.g. "/foo?bar=1"
   * @param {string} userAgent
   */
  isAllowed(pathWithQuery, userAgent = '*') {
    const group = this._matchGroup(userAgent);
    if (!group) return true;

    let best = null;
    for (const rule of group.rules) {
      if (rule.regex.test(pathWithQuery)) {
        if (!best || rule.length > best.length) best = rule;
      }
    }
    if (!best) return true;
    return best.type === 'allow';
  }

  getCrawlDelay(userAgent = '*') {
    const group = this._matchGroup(userAgent);
    return group ? group.crawlDelay : null;
  }
}

async function fetchRobotsTxt(origin, fetchUrl, userAgent) {
  try {
    const res = await fetchUrl(new URL('/robots.txt', origin).toString(), { userAgent, retries: 0 });
    if (res.ok) return new RobotsTxt(res.body || '');
  } catch {
    /* ignore, default to permissive */
  }
  return new RobotsTxt('');
}

module.exports = { RobotsTxt, fetchRobotsTxt, patternToRegExp };
