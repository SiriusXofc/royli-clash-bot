const fs = require('node:fs');
const Redis = require('ioredis');
const config = require('../config');
const logger = require('../logger');

let client;

function enabled() {
  return config.REDIS_ENABLED && Boolean(config.REDIS_URL || config.NORI_REDIS_URL);
}

function secret(fileKey, base64Key) {
  const aliasFileKey = `NORI_${fileKey}`;
  const aliasBase64Key = `NORI_${base64Key}`;
  const encoded = config[base64Key] || config[aliasBase64Key];
  if (encoded) return Buffer.from(encoded, 'base64').toString('utf8');
  const file = config[fileKey] || config[aliasFileKey];
  if (file) {
    try { return fs.readFileSync(file, 'utf8'); } catch (error) {
      logger.warn({ event: 'redis.tls_material_read_failed', material: fileKey, err: error }, 'Não foi possível ler o certificado TLS do Redis');
    }
  }
  return '';
}

function key(name) {
  return `${config.REDIS_PREFIX}:${String(name).replace(/^:+/, '')}`;
}

function getClient() {
  if (!enabled()) return null;
  if (!client) {
    const url = config.REDIS_URL || config.NORI_REDIS_URL;
    const ca = secret('REDIS_CA_FILE', 'REDIS_CA_B64');
    const cert = secret('REDIS_CERT_FILE', 'REDIS_CERT_B64');
    const keyMaterial = secret('REDIS_KEY_FILE', 'REDIS_KEY_B64');
    const tls = url.startsWith('rediss://') ? {
      ca: ca || undefined,
      cert: cert || undefined,
      key: keyMaterial || undefined,
      servername: config.REDIS_TLS_SERVERNAME || config.NORI_REDIS_TLS_SERVERNAME || new URL(url).hostname,
      rejectUnauthorized: true
    } : undefined;
    client = new Redis(url, {
      ...(tls ? { tls } : {}),
      maxRetriesPerRequest: 0,
      enableReadyCheck: true,
      connectTimeout: 2500,
      commandTimeout: 1500,
      keepAlive: 10000,
      retryStrategy: (attempt) => Math.min(30000, 250 * (2 ** Math.min(attempt, 7))),
      reconnectOnError: () => true
    });
    client.on('ready', () => logger.info({ event: 'redis.ready', tls: Boolean(tls) }, 'Redis conectado'));
    client.on('error', (error) => logger.warn({ event: 'redis.error', err: error }, 'Erro na conexão com o Redis'));
  }
  return client;
}

async function getJson(name) {
  const redis = getClient();
  if (!redis) return null;
  try {
    const value = await redis.get(key(name));
    return value ? JSON.parse(value) : null;
  } catch (error) {
    logger.warn({ event: 'redis.read_failed', operation: 'get', keyName: name, err: error }, 'Falha ao ler cache do Redis');
    return null;
  }
}

async function setJson(name, value, ttlSeconds) {
  const redis = getClient();
  if (!redis) return false;
  try {
    await redis.set(key(name), JSON.stringify(value), 'EX', Math.max(1, ttlSeconds));
    return true;
  } catch (error) {
    logger.warn({ event: 'redis.write_failed', operation: 'set', keyName: name, err: error }, 'Falha ao gravar cache no Redis');
    return false;
  }
}

async function setLock(name, ttlSeconds) {
  const redis = getClient();
  if (!redis) return true;
  try {
    return (await redis.set(key(name), '1', 'EX', ttlSeconds, 'NX')) === 'OK';
  } catch (error) {
    logger.warn({ event: 'redis.lock_failed', operation: 'set_lock', keyName: name, err: error }, 'Falha ao criar lock no Redis');
    return false;
  }
}

async function del(name) {
  const redis = getClient();
  if (!redis) return false;
  try { return (await redis.del(key(name))) > 0; } catch { return false; }
}

async function addToSet(name, value) {
  const redis = getClient();
  if (!redis) return false;
  try { return (await redis.sadd(key(name), value)) >= 0; } catch { return false; }
}

async function removeFromSet(name, value) {
  const redis = getClient();
  if (!redis) return false;
  try { return (await redis.srem(key(name), value)) >= 0; } catch { return false; }
}

async function membersOfSet(name) {
  const redis = getClient();
  if (!redis) return [];
  try { return await redis.smembers(key(name)); } catch { return []; }
}

module.exports = { addToSet, del, enabled, getJson, getClient, key, membersOfSet, removeFromSet, setJson, setLock };
