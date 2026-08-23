const { Client, Events, GatewayIntentBits, MessageFlags } = require('discord.js');
const config = require('./config');
const logger = require('./logger');
const { normalizePlayerTag } = require('./utils');
const { ClashRoyaleError, getPlayerWithStaleFallback } = require('./services/clashRoyale');
const { renderPlayerPanel } = require('./ui/playerPanel');
const { PanelManager } = require('./panelManager');
const { registerCommands } = require('./registerCommands');
const { RelayMonitor } = require('./services/relayMonitor');
const { renderErrorPanel } = require('./ui/errorPanel');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const panels = new PanelManager(client);
const relayMonitor = new RelayMonitor(client);

client.once(Events.ClientReady, (readyClient) => {
  logger.info({ event: 'discord.ready', user: readyClient.user.tag }, 'Royli conectado ao Discord');
  if (!config.EPHEMERAL_RESPONSES) panels.start();
  relayMonitor.start();
  registerCommands().catch((error) => {
    logger.error({ event: 'commands.registration_failed', err: error }, 'Falha ao registrar comandos automaticamente');
  });
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === 'jogador') {
      await handlePlayerCommand(interaction);
      return;
    }
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('royli:player:')) {
      await handlePlayerSelect(interaction);
    }
  } catch (error) {
    logger.error({
      event: 'interaction.failed',
      interactionId: interaction.id,
      interactionType: interaction.type,
      commandName: interaction.commandName,
      err: error
    }, 'Falha ao processar interação');
    const message = error instanceof ClashRoyaleError || error.message?.startsWith('Informe uma tag válida')
      ? error.message
      : 'Não consegui montar o painel agora. Tente novamente em instantes.';
    if (interaction.deferred || interaction.replied) await interaction.editReply(renderErrorPanel(message)).catch(() => {});
    else await interaction.reply({ content: message, flags: MessageFlags.Ephemeral }).catch(() => {});
  }
});

async function handlePlayerCommand(interaction) {
  const startedAt = Date.now();
  const rawTag = interaction.options.getString('tag', true);
  const tag = normalizePlayerTag(rawTag);
  logger.info({ event: 'player.query_started', interactionId: interaction.id }, 'Consulta de jogador iniciada');
  await interaction.deferReply({ flags: config.EPHEMERAL_RESPONSES ? MessageFlags.Ephemeral : undefined });
  const data = await getPlayerWithStaleFallback(tag);
  const response = renderPlayerPanel(data);
  const message = await interaction.editReply(response);
  if (!config.EPHEMERAL_RESPONSES) panels.register(message, tag);
  logger.info({
    event: 'player.query_completed',
    interactionId: interaction.id,
    durationMs: Date.now() - startedAt,
    ephemeral: config.EPHEMERAL_RESPONSES
  }, 'Consulta de jogador concluída');
}

async function handlePlayerSelect(interaction) {
  const [, , encodedTag] = interaction.customId.split(':');
  const page = interaction.values[0];
  const tag = normalizePlayerTag(encodedTag);
  const startedAt = Date.now();
  await interaction.deferUpdate();
  const data = await getPlayerWithStaleFallback(tag);
  const response = renderPlayerPanel(data, page);
  await interaction.editReply(response);
  panels.setPage(interaction.message.id, page);
  logger.debug({
    event: 'player.section_changed',
    interactionId: interaction.id,
    page,
    durationMs: Date.now() - startedAt
  }, 'Seção do painel alterada');
}

client.login(config.DISCORD_TOKEN).catch((error) => {
  logger.fatal({ event: 'discord.login_failed', err: error }, 'Falha ao conectar ao Discord');
  process.exitCode = 1;
});
