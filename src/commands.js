const { SlashCommandBuilder } = require('@discordjs/builders');

const commands = [new SlashCommandBuilder()
  .setName('jogador')
  .setDescription('Consulta o perfil completo de um jogador do Clash Royale')
  .addStringOption((option) => option
    .setName('tag')
    .setDescription('Tag do jogador, por exemplo #ABC123')
    .setRequired(true))
  .setIntegrationTypes(0, 1)
  .setContexts(0, 1, 2)
  .toJSON()];

module.exports = { commands };
