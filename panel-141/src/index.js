'use strict';

const { banner, log } = require('./utils');
const { mainMenu }    = require('./menu');

process.on('SIGINT', () => {
  const chalk = require('chalk');
  console.log(chalk.gray('\n\n  Painel 141 encerrado.\n'));
  process.exit(0);
});

(async () => {
  banner();
  log('Iniciando Painel 141...', 'info');
  await new Promise(r => setTimeout(r, 800));
  await mainMenu();
})();
