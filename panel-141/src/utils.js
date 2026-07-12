'use strict';
const chalk = require('chalk');

function banner() {
  const lines = [
    '',
    chalk.red('  ██╗  ██╗ ██╗'),
    chalk.red('  ██║  ██║███║'),
    chalk.red('  ███████║╚██║'),
    chalk.red('  ╚════██║ ██║'),
    chalk.red('       ██║ ██║'),
    chalk.red('       ╚═╝ ╚═╝'),
    '',
    chalk.gray('  ─────────────────────────────────'),
    chalk.white('     PAINEL ') + chalk.red('141') + chalk.white(' — Discord Panel'),
    chalk.gray('  ─────────────────────────────────'),
    '',
  ];
  console.clear();
  console.log(lines.join('\n'));
}

function log(msg, type = 'info') {
  const ts = new Date().toLocaleTimeString('pt-BR');
  const prefix = {
    info:    chalk.cyan(`[${ts}] [INFO]`),
    ok:      chalk.green(`[${ts}] [OK]`),
    warn:    chalk.yellow(`[${ts}] [AVISO]`),
    error:   chalk.red(`[${ts}] [ERRO]`),
    send:    chalk.magenta(`[${ts}] [ENVIO]`),
  }[type] || chalk.white(`[${ts}]`);
  console.log(`${prefix} ${msg}`);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = { banner, log, sleep, randomBetween };
