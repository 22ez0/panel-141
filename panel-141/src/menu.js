'use strict';
const inquirer = require('inquirer');
const chalk    = require('chalk');
const { banner, log, randomBetween } = require('./utils');
const { validateToken, getChannels, sendMessage, sendFile } = require('./discord');
const cfg = require('./config');

// ─── 1. Tokens ───────────────────────────────────────────────────────────────
async function menuTokens(config) {
  banner();
  console.log(chalk.yellow('  [ TOKENS — USUARIO OU BOT ]\n'));
  console.log(chalk.gray('  Tokens atuais: ') + chalk.white(config.tokens.length) + '\n');

  const { action } = await inquirer.prompt([{
    type: 'list', name: 'action', message: 'O que deseja fazer?',
    choices: [
      { name: 'Adicionar token(s)', value: 'add' },
      { name: 'Listar e validar tokens', value: 'list' },
      { name: 'Limpar todos', value: 'clear' },
      { name: '← Voltar', value: 'back' },
    ],
  }]);

  if (action === 'back') return;

  if (action === 'add') {
    console.log(chalk.gray('\n  Cole um token por linha. Linha em branco para finalizar.\n'));
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
    if (!config.tokens.length) { log('Nenhum token.', 'warn'); await new Promise(r => setTimeout(r, 1500)); return; }
    console.log('');
    for (let i = 0; i < config.tokens.length; i++) {
      const short = config.tokens[i].substring(0, 24) + '...';
      process.stdout.write(chalk.gray(`  [${i + 1}] ${short} `));
      const { ok, user, error } = await validateToken(config.tokens[i]);
      if (ok) {
        const tag = user.discriminator && user.discriminator !== '0'
          ? `${user.username}#${user.discriminator}` : user.username;
        console.log(chalk.green(`✓ ${tag}`));
      } else {
        console.log(chalk.red(`✗ ${error}`));
      }
    }
    console.log('');
    await inquirer.prompt([{ type: 'input', name: '_', message: 'Enter para voltar...' }]);
  }

  if (action === 'clear') {
    config.tokens = [];
    cfg.save(config);
    log('Tokens removidos.', 'ok');
    await new Promise(r => setTimeout(r, 1000));
  }
}

// ─── 2. Usuarios Simultaneos ─────────────────────────────────────────────────
async function menuUsuarios(config) {
  banner();
  console.log(chalk.yellow('  [ CONTAS ATIVAS ]\n'));

  const max = Math.min(100, config.tokens.length || 100);
  const { qtd } = await inquirer.prompt([{
    type: 'number', name: 'qtd',
    message: `Quantas contas usar? (1–${max})`,
    validate: v => Number.isInteger(v) && v >= 1 && v <= 100 ? true : 'Numero entre 1 e 100',
  }]);

  config.simultaneousUsers = qtd;
  cfg.save(config);
  log(`Contas ativas: ${qtd}`, 'ok');
  await new Promise(r => setTimeout(r, 1000));
}

// ─── 3. Servidor & Canais ────────────────────────────────────────────────────
async function menuServidor(config) {
  banner();
  console.log(chalk.yellow('  [ SERVIDOR & CANAIS ]\n'));

  const { serverId } = await inquirer.prompt([{
    type: 'input', name: 'serverId',
    message: 'ID do servidor (Guild ID):',
    default: config.serverId,
    validate: v => v.trim() ? true : 'Obrigatorio',
  }]);
  config.serverId = serverId.trim();

  if (config.tokens.length) {
    log('Buscando canais...', 'info');
    try {
      const channels = await getChannels(config.tokens[0], config.serverId);
      if (channels.length) {
        console.log(chalk.green(`\n  ${channels.length} canal(is) encontrado(s):\n`));
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
      log(`Erro ao buscar canais: ${e.message}`, 'error');
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
  log(`Servidor e ${config.channels.length} canal(is) salvos.`, 'ok');
  await new Promise(r => setTimeout(r, 1000));
}

// ─── 4. Mensagem & Midia ─────────────────────────────────────────────────────
async function menuMensagem(config) {
  banner();
  console.log(chalk.yellow('  [ MENSAGEM & MIDIA ]\n'));

  const { msg } = await inquirer.prompt([{
    type: 'input', name: 'msg',
    message: 'Mensagem a enviar (deixe vazio para so midia):',
    default: config.message || '',
  }]);
  config.message = msg.trim();

  const { hasMedia } = await inquirer.prompt([{
    type: 'confirm', name: 'hasMedia',
    message: 'Enviar midia (foto/video)?',
    default: !!config.mediaPath,
  }]);

  if (hasMedia) {
    const { mediaPath } = await inquirer.prompt([{
      type: 'input', name: 'mediaPath',
      message: 'Caminho do arquivo (foto ou video):',
      default: config.mediaPath || '',
      validate: v => {
        if (!v.trim()) return 'Obrigatorio';
        if (!require('fs').existsSync(v.trim())) return 'Arquivo nao encontrado';
        return true;
      },
    }]);
    config.mediaPath = mediaPath.trim();
  } else {
    config.mediaPath = '';
  }

  cfg.save(config);
  log('Configuracao salva.', 'ok');
  await new Promise(r => setTimeout(r, 1000));
}

// ─── 5. INICIAR — round-robin sequencial ────────────────────────────────────
async function menuIniciar(config) {
  banner();
  console.log(chalk.yellow('  [ INICIAR — SEQUENCIAL ROUND-ROBIN ]\n'));

  const erros = [];
  if (!config.tokens.length)            erros.push('Sem tokens (opcao 1)');
  if (!config.serverId)                 erros.push('Sem servidor (opcao 3)');
  if (!config.channels.length)          erros.push('Sem canais (opcao 3)');
  if (!config.message && !config.mediaPath) erros.push('Sem mensagem ou midia (opcao 4)');

  if (erros.length) {
    erros.forEach(e => log(e, 'warn'));
    await new Promise(r => setTimeout(r, 2000));
    return;
  }

  const tokens = config.tokens.slice(0, config.simultaneousUsers);

  console.log(chalk.gray('  Modo: cada conta envia 1 mensagem por vez, em sequencia circular\n'));
  console.log(`  ${chalk.cyan('Contas:   ')} ${tokens.length}`);
  console.log(`  ${chalk.cyan('Canais:   ')} ${config.channels.length}`);
  console.log(`  ${chalk.cyan('Mensagem: ')} ${config.message || chalk.gray('(so midia)')}`);
  console.log(`  ${chalk.cyan('Midia:    ')} ${config.mediaPath || chalk.gray('Nenhuma')}`);
  console.log(`  ${chalk.cyan('Modo:     ')} ${chalk.red('INFINITO')} — Ctrl+C para parar`);
  console.log('');

  const { confirm } = await inquirer.prompt([{
    type: 'confirm', name: 'confirm',
    message: chalk.red('Iniciar?'),
  }]);
  if (!confirm) return;

  console.log('');
  log('Iniciando envio sequencial. Ctrl+C para parar.\n', 'info');

  let round   = 0;    // qual conta envia agora
  let total   = 0;    // total de mensagens enviadas
  let chanIdx = 0;    // rotacao de canais

  while (true) {
    const token     = tokens[round % tokens.length];
    const channelId = config.channels[chanIdx % config.channels.length];
    const userNum   = (round % tokens.length) + 1;

    try {
      if (config.mediaPath) {
        await sendFile(token, channelId, config.mediaPath, config.message);
      } else {
        await sendMessage(token, channelId, config.message);
      }
      total++;
      log(`[Conta ${userNum}] enviou → canal ${channelId} | Total: ${chalk.white(total)}`, 'send');
    } catch (e) {
      const msg = e?.response?.data?.message || e.message;
      const retryAfter = e?.response?.data?.retry_after;
      log(`[Conta ${userNum}] Erro: ${msg}`, 'error');
      // rate limit — espera automatico
      if (e?.response?.status === 429 && retryAfter) {
        log(`Rate limit — aguardando ${retryAfter}s`, 'warn');
        await new Promise(r => setTimeout(r, retryAfter * 1000));
      }
    }

    round++;
    // avanca canal a cada volta completa
    if (round % tokens.length === 0) chanIdx++;
  }
}

// ─── STATUS ──────────────────────────────────────────────────────────────────
function showStatus(config) {
  const t  = config.tokens.length;
  const si = config.simultaneousUsers;
  const sv = config.serverId || chalk.red('nao config');
  const ch = config.channels.length;
  const mg = config.message ? config.message.substring(0, 28) : chalk.gray('nao config');
  const md = config.mediaPath ? chalk.green('sim') : chalk.gray('nao');

  return [
    '',
    chalk.gray('  ╔══════════════════════════════════════════╗'),
    chalk.gray('  ║') + chalk.cyan('  PAINEL 141 — STATUS                    ') + chalk.gray('║'),
    chalk.gray('  ╠══════════════════════════════════════════╣'),
    chalk.gray('  ║') + `  Tokens:    ${chalk.white(t)} | Ativas: ${chalk.white(si)}` + ' '.repeat(Math.max(0, 18 - String(t).length - String(si).length)) + chalk.gray('║'),
    chalk.gray('  ║') + `  Servidor:  ${sv}` + ' '.repeat(Math.max(0, 31 - sv.replace(/\x1B\[[0-9;]*m/g,'').length)) + chalk.gray('║'),
    chalk.gray('  ║') + `  Canais:    ${chalk.white(ch)}` + ' '.repeat(Math.max(0, 29 - String(ch).length)) + chalk.gray('║'),
    chalk.gray('  ║') + `  Mensagem:  ${mg}` + ' '.repeat(Math.max(0, 31 - mg.replace(/\x1B\[[0-9;]*m/g,'').length)) + chalk.gray('║'),
    chalk.gray('  ║') + `  Midia:     ${md}` + ' '.repeat(36) + chalk.gray('║'),
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
      message: chalk.white('Selecione:'),
      choices: [
        { name: `${chalk.cyan('1.')} Tokens (usuario / bot)`, value: '1' },
        { name: `${chalk.cyan('2.')} Contas ativas (1–100)`, value: '2' },
        { name: `${chalk.cyan('3.')} Servidor & Canais`, value: '3' },
        { name: `${chalk.cyan('4.')} Mensagem & Midia`, value: '4' },
        { name: `${chalk.red('►')} ${chalk.red('INICIAR ENVIO')}`, value: '5' },
        new inquirer.Separator(),
        { name: chalk.gray('Sair'), value: '0' },
      ],
    }]);

    if (option === '0') { console.log(chalk.gray('\n  Encerrando.\n')); process.exit(0); }
    if (option === '1') { await menuTokens(config);   config = cfg.load(); }
    if (option === '2') { await menuUsuarios(config); config = cfg.load(); }
    if (option === '3') { await menuServidor(config); config = cfg.load(); }
    if (option === '4') { await menuMensagem(config); config = cfg.load(); }
    if (option === '5') { await menuIniciar(config);  config = cfg.load(); }
  }
}

module.exports = { mainMenu };
