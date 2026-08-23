const { request } = require('undici');
const config = require('../config');
const logger = require('../logger');
const { normalizePlayerTag } = require('../utils');
const redis = require('./redis');

class ClashRoyaleError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ClashRoyaleError';
    this.status = status;
  }
}

async function fetchJson(path) {
  const startedAt = Date.now();
  const resource = path.includes('/battlelog') ? 'battlelog' : 'player';
  const relayConfigured = Boolean(config.CLASH_RELAY_BASE_URL && config.CLASH_RELAY_TOKEN);
  if (!relayConfigured && !config.CLASH_ROYALE_API_KEY) {
    throw new ClashRoyaleError('A chave da API do Clash Royale ainda não foi configurada no .env.', 500);
  }
  const baseUrl = relayConfigured ? config.CLASH_RELAY_BASE_URL : config.CLASH_ROYALE_API_BASE_URL;
  const authorization = relayConfigured ? config.CLASH_RELAY_TOKEN : config.CLASH_ROYALE_API_KEY;
  let response;
  try {
    response = await request(`${baseUrl}${path}`, {
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${authorization}`
    },
    headersTimeout: 8000,
    bodyTimeout: 8000
    });
  } catch (error) {
    logger.warn({ event: 'upstream.request_failed', resource, durationMs: Date.now() - startedAt, err: error }, 'Falha na consulta ao serviço de dados');
    throw error;
  }
  const body = await response.body.json().catch(() => ({}));
  if (response.statusCode === 429) {
    logger.warn({ event: 'upstream.rate_limited', resource, statusCode: response.statusCode, durationMs: Date.now() - startedAt }, 'Limite de requisições do serviço de dados atingido');
    throw new ClashRoyaleError('A API atingiu o limite de requisições.', 429);
  }
  if (response.statusCode >= 400) {
    logger.warn({ event: 'upstream.request_rejected', resource, statusCode: response.statusCode, durationMs: Date.now() - startedAt }, 'Consulta rejeitada pelo serviço de dados');
    throw new ClashRoyaleError(body?.message || 'Jogador não encontrado ou API indisponível.', response.statusCode);
  }
  logger.debug({ event: 'upstream.request_completed', resource, statusCode: response.statusCode, durationMs: Date.now() - startedAt }, 'Consulta ao serviço de dados concluída');
  return body;
}

async function getPlayer(tag) {
  const normalizedTag = normalizePlayerTag(tag);
  const encodedTag = encodeURIComponent(normalizedTag);
  const cacheKey = `player:${normalizedTag.slice(1)}`;
  const cached = await redis.getJson(cacheKey);
  if (cached) {
    logger.debug({ event: 'cache.hit', cache: 'player' }, 'Cache de jogador encontrado');
    return cached;
  }
  logger.debug({ event: 'cache.miss', cache: 'player' }, 'Cache de jogador não encontrado');

  const profile = await fetchJson(`/players/${encodedTag}`);
  const battlelog = await getBattlelog(normalizedTag, true);
  const result = { profile, battlelog, fetchedAt: new Date().toISOString() };
  await redis.setJson(cacheKey, result, config.PROFILE_CACHE_TTL_SECONDS);
  return result;
}

async function getBattlelog(tag, skipCache = false) {
  const normalizedTag = normalizePlayerTag(tag);
  const cacheKey = `battlelog:${normalizedTag.slice(1)}`;
  if (!skipCache) {
    const cached = await redis.getJson(cacheKey);
    if (cached) {
      logger.debug({ event: 'cache.hit', cache: 'battlelog' }, 'Cache de batalhas encontrado');
      return cached;
    }
  }
  const battlelog = await fetchJson(`/players/${encodeURIComponent(normalizedTag)}/battlelog`);
  await redis.setJson(cacheKey, battlelog, config.BATTLELOG_CACHE_TTL_SECONDS);
  return battlelog;
}

async function getPlayerWithStaleFallback(tag) {
  try {
    return await getPlayer(tag);
  } catch (error) {
    const normalizedTag = normalizePlayerTag(tag);
    const stale = await redis.getJson(`player:${normalizedTag.slice(1)}`);
    if (stale) {
      logger.warn({ event: 'cache.stale_fallback', err: error }, 'Usando perfil em cache após falha do serviço de dados');
      return stale;
    }
    throw error;
  }
}

module.exports = { ClashRoyaleError, getBattlelog, getPlayerWithStaleFallback };
