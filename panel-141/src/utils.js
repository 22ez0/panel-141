'use strict';
const chalk = require('chalk');

// Banner usa apenas caracteres ASCII basicos — funciona em qualquer CMD Windows
function banner() {
  console.clear();
  console.log('');
  console.log(chalk.red('  +------------------------------------------+'));
  console.log(chalk.red('  |                                          |'));
  console.log(chalk.red('  |') + chalk.white('  ##  ##  ##  ##   ###   ##  ##  ##  ##  ') + chalk.red('|'));
  console.log(chalk.red('  |') + chalk.white('  ##  ## ####  ##  # #   ## ##   ##  ##  ') + chalk.red('|'));
  console.log(chalk.red('  |') + chalk.white('  ##  ##  ##   ##  ###   ####    ##  ##  ') + chalk.red('|'));
  console.log(chalk.red('  |') + chalk.white('   ####   ##  ####  #   ##  ##    ####   ') + chalk.red('|'));
  console.log(chalk.red('  |                                          |'));
  console.log(chalk.red('  +------------------------------------------+'));
  console.log(chalk.red('  |') + chalk.white('      P  A  I  N  E  L  ') + chalk.red.bold(' 1 4 1 ') + chalk.white('          ') + chalk.red('|'));
  console.log(chalk.red('  |') + chalk.gray('      Discord Automation Panel            ') + chalk.red('|'));
  console.log(chalk.red('  +------------------------------------------+'));
  console.log(chalk.gray('\n  [Ctrl+C = sair]   [Ctrl+N = voltar]\n'));
}

function log(msg, tipo = 'info') {
  const ts = new Date().toLocaleTimeString('pt-BR');
  const prefixo = {
    info:  chalk.cyan(`[${ts}] [INFO ]`),
    ok:    chalk.green(`[${ts}] [OK   ]`),
    aviso: chalk.yellow(`[${ts}] [AVISO]`),
    erro:  chalk.red(`[${ts}] [ERRO ]`),
    envio: chalk.magenta(`[${ts}] [ENVIO]`),
  }[tipo] || chalk.white(`[${ts}]`);
  console.log(`${prefixo} ${msg}`);
}

module.exports = { banner, log };
