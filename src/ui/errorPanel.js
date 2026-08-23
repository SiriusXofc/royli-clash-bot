const { ContainerBuilder, TextDisplayBuilder } = require('@discordjs/builders');

function renderErrorPanel(message) {
  const container = new ContainerBuilder()
    .setAccentColor(0xed4245)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### Não foi possível concluir\n${message}`));
  return { components: [container] };
}

module.exports = { renderErrorPanel };
