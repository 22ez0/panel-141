'use strict';
const inquirer = require('inquirer');
const chalk    = require('chalk');
const fs       = require('fs');
const path     = require('path');
const { banner, log, sleep, randomBetween } = require('./utils');
const { validateToken, getChannels, runUser } = require('./discord');
const cfg = require('./config');

// ─── 1. Configurar Tokens ───────────────────────────────────────────────────
async function menuTokens(config) {
  banner();
  console.log(chalk.yellow('  [ CONFIGURAR TOKENS ]\n'));
  console.log(chalk.gray('  Tokens atuais: ') + chalk.white(config.tokens.length));
  console.log(chalk.gray('  (1 token = 1 usuário)\n'));

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
    await sleep(1500);
  }

  if (action === 'list') {
    if (!config.tokens.length) { log('Nenhum token salvo.', 'warn'); await sleep(1500); return; }
    console.log('');
    for (let i = 0; i < config.tokens.length; i++) {
      process.stdout.write(chalk.gray(`  [${i + 1}] Validando... `));
      const { ok, user, error } = await validateToken(config.tokens[i]);
      if (ok) {
        console.log(chalk.green(`✓ ${user.username}#${user.discriminator}`));
      } else {
        console.log(chalk.red(`✗ Inválido — ${error}`));
      }
    }
    console.log('');
    await inquirer.prompt([{ type: 'input', name: '_', message: 'Pressione Enter para voltar...' }]);
  }

  if (action === 'clear') {
    config.tokens = [];
    cfg.save(config);
    log('Todos os tokens foram removidos.', 'ok');
    await sleep(1200);
  }
}

// ─── 2. Configurar Usuários Simultâneos ────────────────────────────────────
async function menuUsuarios(config) {
  banner();
  console.log(chalk.yellow('  [ USUÁRIOS SIMULTÂNEOS ]\n'));
  console.log(chalk.gray('  Tokens disponíveis: ') + chalk.white(config.tokens.length));
  console.log(chalk.gray('  Simultâneos atual:  ') + chalk.white(config.simultaneousUsers) + '\n');

  const { qtd } = await inquirer.prompt([{
    type: 'number', name: 'qtd',
    message: `Quantos usuários simultâneos? (1–${Math.min(100, config.tokens.length || 100)})`,
    validate: v => {
      if (!Number.isInteger(v) || v < 1 || v > 100) return 'Informe um número entre 1 e 100';
      if (config.tokens.length && v > config.tokens.length)
        return `Você tem apenas ${config.tokens.length} token(s) configurado(s)`;
      return true;
    },
  }]);

  config.simultaneousUsers = qtd;
  cfg.save(config);
  log(`Usuários simultâneos definido: ${qtd}`, 'ok');
  await sleep(1200);
}

// ─── 3. Configurar Servidor ─────────────────────────────────────────────────
async function menuServidor(config) {
  banner();
  console.log(chalk.yellow('  [ CONFIGURAR SERVIDOR ]\n'));

  const { serverId } = await inquirer.prompt([{
    type: 'input', name: 'serverId',
    message: 'ID do servidor (Guild ID):',
    default: config.serverId,
    validate: v => v.trim() ? true : 'ID não pode ser vazio',
  }]);

  config.serverId = serverId.trim();

  // Auto-busca canais se houver token
  if (config.tokens.length) {
    log('Buscando canais do servidor...', 'info');
    try {
      const channels = await getChannels(config.tokens[0], config.serverId);
      if (channels.length) {
        console.log(chalk.green(`\n  Encontrado ${channels.length} canal(is) de texto:\n`));
        channels.forEach((c, i) => {
          console.log(chalk.gray(`  [${i + 1}]`) + ` #${c.name} ` + chalk.gray(`(${c.id})`));
        });
        console.log('');

        const { selectedChannels } = await inquirer.prompt([{
          type: 'checkbox', name: 'selectedChannels',
          message: 'Selecione os canais alvo:',
          choices: channels.map(c => ({ name: `#${c.name}`, value: c.id })),
          validate: v => v.length ? true : 'Selecione ao menos 1 canal',
        }]);

        config.channels = selectedChannels;
      }
    } catch (e) {
      log(`Não foi possível buscar canais: ${e.message}`, 'error');
      console.log(chalk.gray('\n  Digite os IDs manualmente (separados por vírgula):'));
      const { manualChannels } = await inquirer.prompt([{
        type: 'input', name: 'manualChannels',
        message: 'IDs dos canais:',
        default: config.channels.join(','),
      }]);
      config.channels = manualChannels.split(',').map(s => s.trim()).filter(Boolean);
    }
  } else {
    const { manualChannels } = await inquirer.prompt([{
      type: 'input', name: 'manualChannels',
      message: 'IDs dos canais (separados por vírgula):',
      default: config.channels.join(','),
    }]);
    config.channels = manualChannels.split(',').map(s => s.trim()).filter(Boolean);
  }

  cfg.save(config);
  log(`Servidor e canais configurados. Canais: ${config.channels.length}`, 'ok');
  await sleep(1200);
}

// ─── 4. Configurar Mensagens e Mídia ────────────────────────────────────────
async function menuMensagens(config) {
  banner();
  console.log(chalk.yellow('  [ MENSAGENS & MÍDIA ]\n'));

  const { ratio } = await inquirer.prompt([{
    type: 'number', name: 'ratio',
    message: 'A cada quantas mensagens enviar 1 mídia? (ex: 10 = 1 mídia a cada 10):',
    default: config.messageRatio,
    validate: v => Number.isInteger(v) && v >= 1 ? true : 'Informe um número ≥ 1',
  }]);
  config.messageRatio = ratio;

  const { hasMedia } = await inquirer.prompt([{
    type: 'confirm', name: 'hasMedia',
    message: 'Deseja configurar mídia (foto/vídeo) para envio?',
    default: !!config.mediaPath,
  }]);

  if (hasMedia) {
    const { mediaPath } = await inquirer.prompt([{
      type: 'input', name: 'mediaPath',
      message: 'Caminho completo do arquivo (foto ou vídeo):',
      default: config.mediaPath || '',
      validate: v => {
        if (!v.trim()) return 'Informe o caminho';
        if (!require('fs').existsSync(v.trim())) return 'Arquivo não encontrado';
        return true;
      },
    }]);
    config.mediaPath = mediaPath.trim();
  }

  cfg.save(config);
  log('Configuração de mensagens salva.', 'ok');
  await sleep(1200);
}

// ─── 5. INICIAR ENVIO ────────────────────────────────────────────────────────
async function menuIniciar(config) {
  banner();
  console.log(chalk.yellow('  [ INICIAR ENVIO ]\n'));

  // Validações
  const erros = [];
  if (!config.tokens.length)   erros.push('Nenhum token configurado (opção 1)');
  if (!config.serverId)        erros.push('ID do servidor não configurado (opção 3)');
  if (!config.channels.length) erros.push('Nenhum canal configurado (opção 3)');

  if (erros.length) {
    erros.forEach(e => log(e, 'warn'));
    await sleep(2000);
    return;
  }

  console.log(chalk.gray('  Resumo:\n'));
  console.log(`  ${chalk.cyan('Tokens/Usuários:  ')} ${config.tokens.length}`);
  console.log(`  ${chalk.cyan('Simultâneos:      ')} ${config.simultaneousUsers}`);
  console.log(`  ${chalk.cyan('Servidor:         ')} ${config.serverId}`);
  console.log(`  ${chalk.cyan('Canais:           ')} ${config.channels.length} canal(is)`);
  console.log(`  ${chalk.cyan('Ratio mídia:      ')} 1 a cada ${config.messageRatio} msgs`);
  console.log(`  ${chalk.cyan('Mídia:            ')} ${config.mediaPath || chalk.gray('Nenhuma')}`);
  console.log('');

  const { msgs } = await inquirer.prompt([{
    type: 'input', name: 'msgs',
    message: 'Mensagens a enviar por usuário (uma por linha, linha em branco para finalizar):',
  }]);

  // Coleta mensagens linha a linha
  console.log(chalk.gray('\n  Digite as mensagens (linha em branco para finalizar):\n'));
  const messages = [];
  const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
  await new Promise(resolve => {
    rl.on('line', line => {
      if (!line.trim()) { rl.close(); resolve(); } else messages.push(line);
    });
  });

  if (!messages.length) {
    log('Nenhuma mensagem fornecida.', 'warn');
    await sleep(1200);
    return;
  }

  const { confirm } = await inquirer.prompt([{
    type: 'confirm', name: 'confirm',
    message: `Enviar ${messages.length} mensagem(s) com ${config.simultaneousUsers} usuário(s) simultâneo(s)?`,
  }]);
  if (!confirm) return;

  console.log('');
  log('Iniciando envio...', 'info');

  // Seleciona tokens para os usuários simultâneos
  const tokensSlice = config.tokens.slice(0, config.simultaneousUsers);

  // Dispara todos em paralelo
  const jobs = tokensSlice.map((token, idx) =>
    runUser({
      token,
      channels: config.channels,
      messages,
      mediaPath: config.mediaPath || null,
      ratio: config.messageRatio,
      userId: idx + 1,
      delayMs: randomBetween(500, 1500),
    })
  );

  const results = await Promise.allSettled(jobs);
  const total   = results.reduce((acc, r) => acc + (r.status === 'fulfilled' ? r.value : 0), 0);

  console.log('');
  log(`Envio concluído. Total enviado: ${chalk.white(total)} mensagem(s).`, 'ok');
  console.log('');
  await inquirer.prompt([{ type: 'input', name: '_', message: 'Pressione Enter para voltar ao menu...' }]);
}

// ─── STATUS ──────────────────────────────────────────────────────────────────
function showStatus(config) {
  const tokens  = config.tokens.length;
  const simult  = config.simultaneousUsers;
  const server  = config.serverId || chalk.red('não configurado');
  const canais  = config.channels.length;
  const ratio   = config.messageRatio;
  const media   = config.mediaPath ? chalk.green('sim') : chalk.gray('não');

  return [
    '',
    chalk.gray('  ╔══════════════════════════════════════════╗'),
    chalk.gray('  ║') + chalk.cyan('  STATUS ATUAL                           ') + chalk.gray('║'),
    chalk.gray('  ╠══════════════════════════════════════════╣'),
    chalk.gray('  ║') + `  Tokens:       ${chalk.white(tokens)} (${simult} simultâneo(s))` + ' '.repeat(Math.max(0, 25 - String(tokens).length - String(simult).length)) + chalk.gray('║'),
    chalk.gray('  ║') + `  Servidor:     ${chalk.white(server)}` + ' '.repeat(Math.max(0, 28 - String(server.replace(/\x1B\[[0-9;]*m/g, '')).length)) + chalk.gray('║'),
    chalk.gray('  ║') + `  Canais:       ${chalk.white(canais)} canal(is)` + ' '.repeat(Math.max(0, 21 - String(canais).length)) + chalk.gray('║'),
    chalk.gray('  ║') + `  Ratio mídia:  1 a cada ${chalk.white(ratio)} msgs` + ' '.repeat(Math.max(0, 19 - String(ratio).length)) + chalk.gray('║'),
    chalk.gray('  ║') + `  Mídia:        ${media}` + ' '.repeat(34) + chalk.gray('║'),
    chalk.gray('  ╚══════════════════════════════════════════╝'),
    '',
  ].join('\n');
}

// ─── MAIN MENU ───────────────────────────────────────────────────────────────
async function mainMenu() {
  let config = cfg.load();

  while (true) {
    banner();
    console.log(showStatus(config));

    const { option } = await inquirer.prompt([{
      type: 'list', name: 'option',
      message: chalk.white('Selecione uma opção:'),
      choices: [
        { name: `${chalk.cyan('1.')} Configurar Tokens / Usuários`, value: '1' },
        { name: `${chalk.cyan('2.')} Usuários Simultâneos (1–100)`, value: '2' },
        { name: `${chalk.cyan('3.')} ID do Servidor & Canais`, value: '3' },
        { name: `${chalk.cyan('4.')} Mensagens & Mídia (foto/vídeo)`, value: '4' },
        { name: `${chalk.green('►')} INICIAR ENVIO`, value: '5' },
        new inquirer.Separator(),
        { name: chalk.red('Sair'), value: '0' },
      ],
    }]);

    if (option === '0') {
      console.log(chalk.gray('\n  Encerrando Painel 141. Até mais.\n'));
      process.exit(0);
    }
    if (option === '1') { await menuTokens(config);    config = cfg.load(); }
    if (option === '2') { await menuUsuarios(config);  config = cfg.load(); }
    if (option === '3') { await menuServidor(config);  config = cfg.load(); }
    if (option === '4') { await menuMensagens(config); config = cfg.load(); }
    if (option === '5') { await menuIniciar(config);   config = cfg.load(); }
  }
}

module.exports = { mainMenu };
