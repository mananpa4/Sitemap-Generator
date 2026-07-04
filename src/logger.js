'use strict';

const LEVELS = { silent: 0, error: 1, warn: 2, info: 3, verbose: 4 };

class Logger {
  constructor(level = 'info') {
    this.setLevel(level);
  }

  setLevel(level) {
    this.level = LEVELS[level] ?? LEVELS.info;
  }

  _ts() {
    return new Date().toISOString();
  }

  error(...args) {
    if (this.level >= LEVELS.error) console.error(`[${this._ts()}] ERROR`, ...args);
  }

  warn(...args) {
    if (this.level >= LEVELS.warn) console.warn(`[${this._ts()}] WARN `, ...args);
  }

  info(...args) {
    if (this.level >= LEVELS.info) console.log(`[${this._ts()}] INFO `, ...args);
  }

  verbose(...args) {
    if (this.level >= LEVELS.verbose) console.log(`[${this._ts()}] DEBUG`, ...args);
  }
}

module.exports = { Logger, LEVELS };
