const os = require('node:os');
const packageInfo = require('../package.json');

const ANSI = Object.freeze({
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[91m',
  green: '\x1b[92m',
  yellow: '\x1b[93m',
  blue: '\x1b[94m',
  magenta: '\x1b[95m',
  cyan: '\x1b[96m',
  gray: '\x1b[90m'
});

const LEVELS = Object.freeze({
  debug: { label: 'DEBUG', icon: '◆', color: ANSI.magenta, priority: 10 },
  info: { label: 'INFO', icon: 'ℹ', color: ANSI.cyan, priority: 20 },
  success: { label: 'OK', icon: '✓', color: ANSI.green, priority: 20 },
  warn: { label: 'WARN', icon: '⚠', color: ANSI.yellow, priority: 30 },
  error: { label: 'ERROR', icon: '✗', color: ANSI.red, priority: 40 },
  fatal: { label: 'FATAL', icon: '✖', color: ANSI.red, priority: 50 }
});

const service = 'royli-clash-bot';
const environment = process.env.NODE_ENV || 'development';
const configuredLevel = String(process.env.LOG_LEVEL || (environment === 'production' ? 'info' : 'debug')).toLowerCase();
const minimumPriority = LEVELS[configuredLevel]?.priority || LEVELS.info.priority;
const colorsEnabled = !['0', 'false', 'off', 'no'].includes(String(process.env.LOG_COLOR || '').trim().toLowerCase())
  && !process.env.NO_COLOR;

const SENSITIVE_KEYS = /authorization|token|secret|password|apikey|api_key|relaytoken|redisurl|discord_token|clash/i;

function paint(value, ...styles) {
  if (!colorsEnabled) return String(value ?? '');
  return `${styles.join('')}${String(value ?? '')}${ANSI.reset}`;
}

function clean(value) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
}

function redactText(value) {
  return clean(value)
    .replace(/(Bearer\s+)[^\s]+/gi, '$1[REDACTED]')
    .replace(/(token|secret|password|api[_-]?key)\s*[=:]\s*[^\s,]+/gi, '$1=[REDACTED]');
}

function formatValue(key, value) {
  if (SENSITIVE_KEYS.test(key)) return '[REDACTED]';
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    const text = redactText(value);
    return /\s/.test(text) ? JSON.stringify(text) : text;
  }
  if (Array.isArray(value)) return `[${value.map((item) => clean(item)).join(',')}]`;
  return '[object]';
}

function formatContext(context) {
  return Object.entries(context || {})
    .filter(([key, value]) => key !== 'err' && value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${formatValue(key, value)}`)
    .join(' ');
}

function formatError(error) {
  if (!error) return '';
  const stack = error.stack || error.message || String(error);
  return String(stack).replace(/(Bearer\s+)[^\s]+/gi, '$1[REDACTED]').replace(/(token|secret|password|api[_-]?key)\s*[=:]\s*[^\s,]+/gi, '$1=[REDACTED]').trim();
}

function write(level, contextOrMessage, maybeMessage, inheritedContext = {}) {
  const style = LEVELS[level] || LEVELS.info;
  if (style.priority < minimumPriority) return;

  const context = typeof contextOrMessage === 'object' && contextOrMessage !== null
    ? { ...inheritedContext, ...contextOrMessage }
    : inheritedContext;
  const message = typeof contextOrMessage === 'string' ? contextOrMessage : maybeMessage;
  const timestamp = new Date().toISOString();
  const prefix = `${paint(style.icon, ANSI.bold, style.color)} ${paint(`[${style.label}]`, ANSI.bold, style.color)}`;
  const metadata = formatContext({ service, version: packageInfo.version, environment, ...context });
  const line = `${prefix} ${paint(timestamp, ANSI.dim)} ${paint(clean(message || 'Sem mensagem'), ANSI.bold)} ${paint(`· ${metadata}`, ANSI.gray)}`;
  process.stdout.write(`${line}\n`);

  if (context.err) {
    const errorText = formatError(context.err);
    if (errorText) {
      const stackLines = errorText.split(/\r?\n/).slice(0, 16);
      process.stdout.write(`${stackLines.map((line) => `${paint('  ↳', ANSI.gray)} ${line}`).join('\n')}\n`);
    }
  }
}

function child(context = {}) {
  return Object.fromEntries(Object.keys(LEVELS).map((level) => [level, (data, message) => write(level, data, message, context)]));
}

const logger = child();
logger.child = child;
logger.service = service;
logger.host = os.hostname();
logger.formatError = formatError;
logger.paint = paint;

module.exports = logger;
