const { request } = require('undici');
const config = require('../config');
const logger = require('../logger');
const redis = require('./redis');

class RelayMonitor {
  constructor(client) {
    this.client = client;
    this.timer = null;
    this.running = false;
    this.lastIp = null;
  }

  start() {
    if (!config.CLASH_RELAY_BASE_URL || !config.CLASH_RELAY_TOKEN || !config.RELAY_OWNER_USER_ID) {
      logger.warn({ event: 'availability_monitor.disabled', reason: 'missing_configuration' }, 'Monitor de disponibilidade desativado');
      return;
    }
    this.check().catch((error) => logger.warn({ event: 'availability_check.failed', attempt: 'initial', err: error }, 'Falha na verificação inicial de disponibilidade'));
    this.timer = setInterval(() => {
      this.check().catch((error) => logger.warn({ event: 'availability_check.failed', attempt: 'scheduled', err: error }, 'Falha na verificação agendada de disponibilidade'));
    }, config.RELAY_IP_CHECK_INTERVAL_SECONDS * 1000);
    this.timer.unref?.();
  }

  async check() {
    if (this.running) return;
    this.running = true;
    try {
      const response = await request(`${config.CLASH_RELAY_BASE_URL}/egress-ip`, {
        headers: { authorization: `Bearer ${config.CLASH_RELAY_TOKEN}`, accept: 'application/json' },
        headersTimeout: 8000,
        bodyTimeout: 8000
      });
      const body = await response.body.json().catch(() => ({}));
      if (response.statusCode >= 400 || !body.ip) throw new Error(body.error || `Relay retornou HTTP ${response.statusCode}`);

      const previous = (await redis.getJson('relay:egress-ip')) || (this.lastIp ? { ip: this.lastIp } : null);
      const current = { ip: body.ip, checkedAt: new Date().toISOString() };
      this.lastIp = current.ip;
      await redis.setJson('relay:egress-ip', current, 60 * 60 * 24 * 30);
      if (previous?.ip === current.ip) return;
      await this.notify(current.ip, previous?.ip);
    } finally {
      this.running = false;
    }
  }

  async notify(ip, previousIp) {
    const user = await this.client.users.fetch(config.RELAY_OWNER_USER_ID);
    const change = previousIp ? `IP anterior: ${previousIp}\n` : '';
    await user.send([
      '⚠️ O IP de saída da Royli API mudou.',
      '',
      `Novo IP para autorizar no Clash Royale: ${ip}`,
      change,
      `API: ${config.CLASH_RELAY_BASE_URL.replace(/\/v1$/, '')}`
    ].filter(Boolean).join('\n'));
    logger.info({ event: 'availability_change.notified', changed: Boolean(previousIp), ip, previousIp }, 'Notificação de alteração de disponibilidade enviada');
  }
}

module.exports = { RelayMonitor };
