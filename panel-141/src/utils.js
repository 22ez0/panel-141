'use strict';
const chalk = require('chalk');

function banner() {
  console.clear();
  console.log('');
  console.log(chalk.red('  ######################################'));
  console.log(chalk.red('  ##                                  ##'));
  console.log(chalk.red('  ##    __ ') + chalk.white('  _  _  __ ') + chalk.red('               ##'));
  console.log(chalk.red('  ##   /  |') + chalk.white(' | || | \ \\') + chalk.red('               ##'));
  console.log(chalk.red('  ##   | | ') + chalk.white(' | || |  > >') + chalk.red('              ##'));
  console.log(chalk.red('  ##   |_| ') + chalk.white('  \_/  /_/ ') + chalk.red('               ##'));
  console.log(chalk.red('  ##                                  ##'));
  console.log(chalk.red('  ######################################'));
  console.log(chalk.red('  ##') + chalk.white('   P A I N E L  ') + chalk.red.bold('1 4 1') + chalk.white('         ') + chalk.red('##'));
  console.log(chalk.red('  ##') + chalk.gray('   Discord Automation Panel       ') + chalk.red('##'));
  console.log(chalk.red('  ######################################'));
  console.log('');
}

function log(msg, type = 'info') {
  const ts = new Date().toLocaleTimeString('pt-BR');
  const prefix = {
    info:  chalk.cyan(`[${ts}] [INFO]`),
    ok:    chalk.green(`[${ts}] [OK]`),
    warn:  chalk.yellow(`[${ts}] [AVISO]`),
    error: chalk.red(`[${ts}] [ERRO]`),
    send:  chalk.magenta(`[${ts}] [ENVIO]`),
  }[type] || chalk.white(`[${ts}]`);
  console.log(`${prefix} ${msg}`);
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = { banner, log, randomBetween };
