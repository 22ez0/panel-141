'use strict';
const chalk = require('chalk');

function banner() {
  console.clear();
  console.log('');
  console.log(chalk.red('  ██████╗  ██╗  ██╗ ██╗'));
  console.log(chalk.red('  ╚════██╗ ██║  ██║ ██║'));
  console.log(chalk.red('      ██╔╝ ███████║ ██║'));
  console.log(chalk.red('     ██╔╝  ╚════██║ ╚═╝'));
  console.log(chalk.red('    ██████╗      ██║ ██╗'));
  console.log(chalk.red('    ╚═════╝      ╚═╝ ╚═╝'));
  console.log('');
  console.log(chalk.gray('  ─────────────────────────────────────'));
  console.log(chalk.white('     PAINEL ') + chalk.red('141') + chalk.white(' — Discord Panel'));
  console.log(chalk.gray('  ─────────────────────────────────────'));
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
