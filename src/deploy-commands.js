const logger = require('./logger');
const { registerCommands } = require('./registerCommands');

registerCommands().catch((error) => {
  logger.error({ err: error }, 'Falha ao registrar comandos');
  process.exitCode = 1;
});
