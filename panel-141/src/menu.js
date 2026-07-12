'use strict';
const inquirer = require('inquirer');
const chalk    = require('chalk');
const { banner, log, randomBetween } = require('./utils');
const { validateToken, getChannels, runUserLoop } = require('./discord');
const cfg = require('./config');

// ─── 1. Tokens ───────────────────────────────────────────────────────────────
async function menuTokens(config) {
  banner();
  console.log(chalk.yellow('  [ TOKENS — USUARIO OU BOT ]\n'));
  console.log(chalk.gray('  Tokens atuais: ') + chalk.white(config.tokens.length));
  console.log(chalk.gray('  Suporta: token de usuario Discord e token de Bot\n'));

  const { action } = await inquirer.prompt([{
    type: 'list', name: 'action', message: 'O que deseja fazer?',
    choices: [
      { name: 'Adicionar token(s)', value: 'add' },
      { name: 'Listar e validar tokens', value: 'list' },
      { name: 'Limpar todos os tokens', value: 'clear' },
      { name: '← Voltar', value: 'back' },
    ],
  }]);

  if (action === 'back') return;

  if (action === 'add') {
    console.log(chalk.gray('\n  Cole um token por linha (usuario ou bot). Linha em branco para finalizar.\n'));
    const tokens = [];
    const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
    await new Promise(resolve => {
      rl.on('line', line => {
        const t = line.trim();
        if (!t) { rl.close(); resolve(); } else tokens.push(t);
      });
    });
    config.tokens = [...new Set([...config.tokens, ...tokens])];
    cfg.save(config);
    log(`${tokens.length} token(s) adicionado(s). Total: ${config.tokens.length}`, 'ok');
    await new Promise(r => setTimeout(r, 1500));
  }

  if (action === 'list') {
    if (!config.tokens.length) { log('Nenhum token salvo.', 'warn'); await new Promise(r => setTimeout(r, 1500)); return; }
    console.log('');
    for (let i = 0; i < config.tokens.length; i++) {
      const short = config.tokens[i].substring(0, 20) + '...';
      process.stdout.write(chalk.gray(`  [${i + 1}] ${short} — validando... `));
      const { ok, user, error } = await validateToken(config.tokens[i]);
      if (ok) {
        const tag = user.discriminator && user.discriminator !== '0'
          ? `${user.username}#${user.discriminator}`
          : user.username;
        console.log(chalk.green(`✓ ${tag}`));
      } else {
        console.log(chalk.red(`✗ Invalido — ${error}`));
      }
    }
    console.log('');
    await inquirer.prompt([{ type: 'input', name: '_', message: 'Pressione Enter para voltar...' }]);
  }

  if (action === 'clear') {
    config.tokens = [];
    cfg.save(config);
    log('Todos os tokens foram removidos.', 'ok');
    await new Promise(r => setTimeout(r, 1200));
  }
}

// ─── 2. Usuarios Simultaneos ─────────────────────────────────────────────────
async function menuUsuarios(config) {
  banner();
  console.log(chalk.yellow('  [ USUARIOS SIMULTANEOS ]\n'));
  console.log(chalk.gray('  Tokens: ') + chalk.white(config.tokens.length));
  console.log(chalk.gray('  Atual:  ') + chalk.white(config.simultaneousUsers) + '\n');

  const max = Math.min(100, config.tokens.length || 100);
  const { qtd } = await inquirer.prompt([{
    type: 'number', name: 'qtd',
    message: `Quantos usuarios simultaneos? (1–${max})`,
    validate: v => {
      if (!Number.isInteger(v) || v < 1 || v > 100) return 'Numero entre 1 e 100';
      if (config.tokens.length && v > config.tokens.length)
        return `So ha ${config.tokens.length} token(s)`;
      return true;
    },
  }]);

  config.simultaneousUsers = qtd;
  cfg.save(config);
  log(`Usuarios simultaneos: ${qtd}`, 'ok');
  await new Promise(r => setTimeout(r, 1200));
}

// ─── 3. Servidor & Canais ────────────────────────────────────────────────────
async function menuServidor(config) {
  banner();
  console.log(chalk.yellow('  [ SERVIDOR & CANAIS ]\n'));

  const { serverId } = await inquirer.prompt([{
    type: 'input', name: 'serverId',
    message: 'ID do servidor (Guild ID):',
    default: config.serverId,
    validate: v => v.trim() ? true : 'ID nao pode ser vazio',
  }]);

  config.serverId = serverId.trim();

  if (config.tokens.length) {
    log('Buscando canais...', 'info');
    try {
      const channels = await getChannels(config.tokens[0], config.serverId);
      if (channels.length) {
        console.log(chalk.green(`\n  ${channels.length} canal(is) de texto encontrado(s):\n`));
        channels.forEach((c, i) => console.log(chalk.gray(`  [${i + 1}]`) + ` #${c.name} ` + chalk.gray(`(${c.id})`)));
        console.log('');

        const { sel } = await inquirer.prompt([{
          type: 'checkbox', name: 'sel',
          message: 'Selecione os canais alvo:',
          choices: channels.map(c => ({ name: `#${c.name}`, value: c.id })),
          validate: v => v.length ? true : 'Selecione ao menos 1',
        }]);
        config.channels = sel;
      }
    } catch (e) {
      log(`Nao foi possivel buscar canais: ${e.message}`, 'error');
      const { manual } = await inquirer.prompt([{
        type: 'input', name: 'manual',
        message: 'IDs dos canais (separados por virgula):',
        default: config.channels.join(','),
      }]);
      config.channels = manual.split(',').map(s => s.trim()).filter(Boolean);
    }
  } else {
    const { manual } = await inquirer.prompt([{
      type: 'input', name: 'manual',
      message: 'IDs dos canais (separados por virgula):',
      default: config.channels.join(','),
    }]);
    config.channels = manual.split(',').map(s => s.trim()).filter(Boolean);
  }

  cfg.save(config);
  log(`Servidor e canais salvos. Canais: ${config.channels.length}`, 'ok');
  await new Promise(r => setTimeout(r, 1200));
}

// ─── 4. Mensagem & Midia ─────────────────────────────────────────────────────
async function menuMensagem(config) {
  banner();
  console.log(chalk.yellow('  [ MENSAGEM & MIDIA ]\n'));
  console.log(chalk.gray('  Envio infinito — sem limite de mensagens\n'));

  const { msg } = await inquirer.prompt([{
    type: 'input', name: 'msg',
    message: 'Mensagem a enviar (deixe em branco para so midia):',
    default: config.message || '',
  }]);
  config.message = msg.trim();

  const { delay } = await inquirer.prompt([{
    type: 'number', name: 'delay',
    message: 'Intervalo entre mensagens em ms (ex: 1000 = 1s, 0 = sem espera):',
    default: config.delayMs || 1000,
    validate: v => v >= 0 ? true : 'Valor minimo: 0',
  }]);
  config.delayMs = delay;

  const { hasMedia } = await inquirer.prompt([{
    type: 'confirm', name: 'hasMedia',
    message: 'Enviar midia (foto/video) junto com as mensagens?',
    default: !!config.mediaPath,
  }]);

  if (hasMedia) {
    const { mediaPath } = await inquirer.prompt([{
      type: 'input', name: 'mediaPath',
      message: 'Caminho completo do arquivo (foto ou video):',
      default: config.mediaPath || '',
      validate: v => {
        if (!v.trim()) return 'Informe o caminho';
        if (!require('fs').existsSync(v.trim())) return 'Arquivo nao encontrado';
        return true;
      },
    }]);
    config.mediaPath = mediaPath.trim();
  } else {
    config.mediaPath = '';
  }

  cfg.save(config);
  log('Mensagem configurada.', 'ok');
  await new Promise(r => setTimeout(r, 1200));
}

// ─── 5. INICIAR (loop infinito) ──────────────────────────────────────────────
async function menuIniciar(config) {
  banner();
  console.log(chalk.yellow('  [ INICIAR ENVIO INFINITO ]\n'));

  const erros = [];
  if (!config.tokens.length)   erros.push('Nenhum token configurado (opcao 1)');
  if (!config.serverId)        erros.push('ID do servidor nao configurado (opcao 3)');
  if (!config.channels.length) erros.push('Nenhum canal configurado (opcao 3)');
  if (!config.message && !config.mediaPath) erros.push('Configure mensagem ou midia (opcao 4)');

  if (erros.length) {
    erros.forEach(e => log(e, 'warn'));
    await new Promise(r => setTimeout(r, 2500));
    return;
  }

  console.log(chalk.gray('  Resumo:\n'));
  console.log(`  ${chalk.cyan('Tokens/Usuarios: ')} ${config.tokens.length}`);
  console.log(`  ${chalk.cyan('Simultaneos:     ')} ${config.simultaneousUsers}`);
  console.log(`  ${chalk.cyan('Servidor:        ')} ${config.serverId}`);
  console.log(`  ${chalk.cyan('Canais:          ')} ${config.channels.length}`);
  console.log(`  ${chalk.cyan('Mensagem:        ')} ${config.message || chalk.gray('(so midia)')}`);
  console.log(`  ${chalk.cyan('Midia:           ')} ${config.mediaPath || chalk.gray('Nenhuma')}`);
  console.log(`  ${chalk.cyan('Intervalo:       ')} ${config.delayMs}ms`);
  console.log(`  ${chalk.cyan('Modo:            ')} ${chalk.red('INFINITO')} (Ctrl+C para parar)`);
  console.log('');

  const { confirm } = await inquirer.prompt([{
    type: 'confirm', name: 'confirm',
    message: chalk.red('Iniciar envio infinito?'),
  }]);
  if (!confirm) return;

  const tokens = config.tokens.slice(0, config.simultaneousUsers);
  let totalGlobal = 0;

  console.log('');
  log(`Iniciando ${tokens.length} usuario(s) em loop infinito. Ctrl+C para parar.`, 'info');
  console.log('');

  const jobs = tokens.map((token, idx) =>
    runUserLoop({
      token,
      channels: config.channels,
      message: config.message,
      mediaPath: config.mediaPath || null,
      userId: idx + 1,
      delayMs: config.delayMs,
      onSend: (uid, count, ch) => {
        totalGlobal++;
        log(`[User ${uid}] #${count} → canal ${ch} | Total: ${totalGlobal}`, 'send');
      },
      onError: (uid, err) => log(`[User ${uid}] Erro: ${err}`, 'error'),
    })
  );

  // Espera Ctrl+C
  await Promise.race(jobs);
}

// ─── STATUS ──────────────────────────────────────────────────────────────────
function showStatus(config) {
  const clean = s => s.replace(/\x1B\[[0-9;]*m/g, '');
  const pad   = (s, n) => s + ' '.repeat(Math.max(0, n - clean(s).length));
  const t  = config.tokens.length;
  const si = config.simultaneousUsers;
  const sv = config.serverId || chalk.red('nao configurado');
  const ch = config.channels.length;
  const dl = `${config.delayMs || 1000}ms`;
  const md = config.mediaPath ? chalk.green('sim') : chalk.gray('nao');
  const mg = config.message ? chalk.white(config.message.substring(0, 25) + (config.message.length > 25 ? '...' : '')) : chalk.gray('nao configurada');

  return [
    '',
    chalk.gray('  ╔══════════════════════════════════════════╗'),
    chalk.gray('  ║') + chalk.cyan('  STATUS                                 ') + chalk.gray('║'),
    chalk.gray('  ╠══════════════════════════════════════════╣'),
    chalk.gray('  ║') + pad(`  Tokens:    ${chalk.white(t)} (${si} simult.)`, 45) + chalk.gray('║'),
    chalk.gray('  ║') + pad(`  Servidor:  ${sv}`, 45) + chalk.gray('║'),
    chalk.gray('  ║') + pad(`  Canais:    ${chalk.white(ch)} canal(is)`, 45) + chalk.gray('║'),
    chalk.gray('  ║') + pad(`  Mensagem:  ${mg}`, 45) + chalk.gray('║'),
    chalk.gray('  ║') + pad(`  Midia:     ${md}  Intervalo: ${chalk.white(dl)}`, 45) + chalk.gray('║'),
    chalk.gray('  ╚══════════════════════════════════════════╝'),
    '',
  ].join('\n');
}

// ─── MENU PRINCIPAL ──────────────────────────────────────────────────────────
async function mainMenu() {
  let config = cfg.load();

  while (true) {
    banner();
    console.log(showStatus(config));

    const { option } = await inquirer.prompt([{
      type: 'list', name: 'option',
      message: chalk.white('Selecione uma opcao:'),
      choices: [
        { name: `${chalk.cyan('1.')} Tokens (usuario ou bot)`, value: '1' },
        { name: `${chalk.cyan('2.')} Usuarios Simultaneos (1–100)`, value: '2' },
        { name: `${chalk.cyan('3.')} ID do Servidor & Canais`, value: '3' },
        { name: `${chalk.cyan('4.')} Mensagem & Midia`, value: '4' },
        { name: `${chalk.red('►')} ${chalk.red('INICIAR ENVIO INFINITO')}`, value: '5' },
        new inquirer.Separator(),
        { name: chalk.gray('Sair'), value: '0' },
      ],
    }]);

    if (option === '0') {
      console.log(chalk.gray('\n  Encerrando Painel 141.\n'));
      process.exit(0);
    }
    if (option === '1') { await menuTokens(config);   config = cfg.load(); }
    if (option === '2') { await menuUsuarios(config); config = cfg.load(); }
    if (option === '3') { await menuServidor(config); config = cfg.load(); }
    if (option === '4') { await menuMensagem(config); config = cfg.load(); }
    if (option === '5') { await menuIniciar(config);  config = cfg.load(); }
  }
}

module.exports = { mainMenu };
