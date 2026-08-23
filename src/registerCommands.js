const { REST, Routes } = require('discord.js');
const config = require('./config');
const logger = require('./logger');
const { commands } = require('./commands');

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN);
  await rest.put(Routes.applicationCommands(config.DISCORD_CLIENT_ID), { body: commands });
  logger.info({ count: commands.length }, 'Comandos globais registrados automaticamente');
}

module.exports = { registerCommands };
