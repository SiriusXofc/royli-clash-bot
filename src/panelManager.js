const crypto = require('node:crypto');
const config = require('./config');
const logger = require('./logger');
const redis = require('./services/redis');
const { getPlayerWithStaleFallback } = require('./services/clashRoyale');
const { renderPlayerPanel } = require('./ui/playerPanel');

class PanelManager {
  constructor(client) {
    this.client = client;
    this.panels = new Map();
    this.timer = null;
  }

  async start() {
    if (this.timer) return;
    await this.hydrate();
    this.timer = setInterval(() => this.refreshAll(), config.PANEL_REFRESH_INTERVAL_SECONDS * 1000);
    this.timer.unref?.();
    logger.info({ event: 'panels.manager_started', activePanels: this.panels.size, intervalSeconds: config.PANEL_REFRESH_INTERVAL_SECONDS }, 'Gerenciador de atualização dos painéis iniciado');
  }

  register(message, tag, page = 'overview') {
    const entry = { channelId: message.channelId, messageId: message.id, tag, page, lastFingerprint: null, expiresAt: Date.now() + config.PANEL_TTL_SECONDS * 1000 };
    this.panels.set(message.id, entry);
    redis.setJson(`panel:${message.id}`, entry, config.PANEL_TTL_SECONDS).catch(() => {});
    redis.addToSet('panels:index', message.id).catch(() => {});
  }

  async hydrate() {
    for (const messageId of await redis.membersOfSet('panels:index')) {
      const entry = await redis.getJson(`panel:${messageId}`);
      if (entry?.messageId && entry.expiresAt > Date.now()) this.panels.set(messageId, entry);
      else {
        await redis.del(`panel:${messageId}`);
        await redis.removeFromSet('panels:index', messageId);
      }
    }
  }

  setPage(messageId, page) {
    const entry = this.panels.get(messageId);
    if (entry) entry.page = page;
  }

  async refreshAll() {
    for (const entry of this.panels.values()) {
      if (entry.expiresAt <= Date.now()) {
        this.panels.delete(entry.messageId);
        await redis.del(`panel:${entry.messageId}`);
        await redis.removeFromSet('panels:index', entry.messageId);
        continue;
      }
      await this.refresh(entry);
    }
  }

  async refresh(entry) {
    const lock = await redis.setLock(`update-lock:${entry.tag.replace('#', '')}`, 45);
    if (!lock) return;
    try {
      const channel = await this.client.channels.fetch(entry.channelId);
      const message = await channel.messages.fetch(entry.messageId);
      const data = await getPlayerWithStaleFallback(entry.tag);
      const fingerprint = crypto.createHash('sha256').update(JSON.stringify({ profile: data.profile, battlelog: data.battlelog })).digest('hex');
      if (entry.lastFingerprint === fingerprint) return;
      await message.edit(renderPlayerPanel(data, entry.page));
      entry.lastFingerprint = fingerprint;
      await redis.setJson(`panel:${entry.messageId}`, entry, config.PANEL_TTL_SECONDS);
    } catch (error) {
      if (error?.code === 10008 || error?.code === 10003) {
        this.panels.delete(entry.messageId);
        await redis.del(`panel:${entry.messageId}`);
        await redis.removeFromSet('panels:index', entry.messageId);
      }
      else logger.warn({ event: 'panel.refresh_failed', err: error, messageId: entry.messageId }, 'Falha ao atualizar painel');
    }
  }
}

module.exports = { PanelManager };
