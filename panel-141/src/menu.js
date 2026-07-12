'use strict';
const inquirer = require('inquirer');
const chalk    = require('chalk');
const { banner, log } = require('./utils');
const { validateToken, getChannels, sendMessage, sendFile } = require('./discord');
const cfg = require('./config');

// helper — aguarda Enter
async function pressEnter() {
  await inquirer.prompt([{ type: 'input', name: '_', message: 'Pressione Enter para voltar...' }]);
}

// ─── 1. Tokens ───────────────────────────────────────────────────────────────
async function menuTokens(config) {
  while (true) {
    banner();
    console.log(chalk.yellow('  [ TOKENS ]\n'));
    console.log(chalk.gray('  Suporta token de usuario e token de Bot do Discord'));
    console.log(chalk.gray('  Tokens ativos: ') + chalk.white(config.tokens.length) + '\n');

    const { action } = await inquirer.prompt([{
      type: 'list', name: 'action', message: 'Opcao:',
      choices: [
        { name: 'Adicionar tokens (cole 1 a 100 de uma vez)', value: 'add' },
        { name: 'Listar e validar tokens',                    value: 'list' },
        { name: 'Limpar todos os tokens',                     value: 'clear' },
        { name: chalk.gray('← Voltar'),                       value: 'back' },
      ],
    }]);

    if (action === 'back') return;

    if (action === 'add') {
      console.log(chalk.gray('\n  Cole todos os tokens de uma vez, separados por virgula.'));
      console.log(chalk.gray('  Ex: token1,token2,token3  (suporta ate 100)\n'));

      const { raw } = await inquirer.prompt([{
        type: 'input',
        name: 'raw',
        message: 'Cole os tokens (separados por virgula):',
      }]);

      const novos = raw
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);

      const antes = config.tokens.length;
      config.tokens = [...new Set([...config.tokens, ...novos])].slice(0, 100);
      cfg.save(config);

      console.log('');
      log(`${config.tokens.length - antes} token(s) adicionado(s). Total: ${config.tokens.length}/100`, 'ok');
      console.log('');
      await pressEnter();
    }

    if (action === 'list') {
      if (!config.tokens.length) { log('Nenhum token salvo.', 'warn'); await new Promise(r => setTimeout(r, 1500)); continue; }
      console.log('');
      for (let i = 0; i < config.tokens.length; i++) {
        const short = config.tokens[i].substring(0, 26) + '...';
        process.stdout.write(chalk.gray(`  [${String(i+1).padStart(2)}] ${short} `));
        const { ok, user, error } = await validateToken(config.tokens[i]);
        if (ok) {
          const tag = (user.discriminator && user.discriminator !== '0')
            ? `${user.username}#${user.discriminator}` : user.username;
          console.log(chalk.green(`✓ ${tag}`));
        } else {
          console.log(chalk.red(`✗ ${error}`));
        }
      }
      console.log('');
      await pressEnter();
    }

    if (action === 'clear') {
      config.tokens = [];
      cfg.save(config);
      log('Tokens removidos.', 'ok');
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

// ─── 2. Contas Ativas ─────────────────────────────────────────────────────────
async function menuUsuarios(config) {
  while (true) {
    banner();
    console.log(chalk.yellow('  [ CONTAS ATIVAS ]\n'));
    console.log(chalk.gray('  Tokens disponiveis: ') + chalk.white(config.tokens.length));
    console.log(chalk.gray('  Contas ativas:      ') + chalk.white(config.simultaneousUsers) + '\n');

    const { action } = await inquirer.prompt([{
      type: 'list', name: 'action', message: 'Opcao:',
      choices: [
        { name: 'Definir quantidade de contas', value: 'set' },
        { name: chalk.gray('← Voltar'),          value: 'back' },
      ],
    }]);
    if (action === 'back') return;

    const max = Math.min(100, config.tokens.length || 100);
    const { qtd } = await inquirer.prompt([{
      type: 'number', name: 'qtd',
      message: `Quantas contas simultaneas? (1–${max}):`,
      validate: v => {
        if (!Number.isInteger(v) || v < 1 || v > 100) return 'Entre 1 e 100';
        if (config.tokens.length && v > config.tokens.length) return `Voce tem apenas ${config.tokens.length} token(s)`;
        return true;
      },
    }]);
    config.simultaneousUsers = qtd;
    cfg.save(config);
    log(`Contas ativas definido: ${qtd}`, 'ok');
    await new Promise(r => setTimeout(r, 1000));
  }
}

// ─── 3. Servidor & Canais ────────────────────────────────────────────────────
async function menuServidor(config) {
  while (true) {
    banner();
    console.log(chalk.yellow('  [ SERVIDOR & CANAIS ]\n'));
    console.log(chalk.gray('  Servidor: ') + chalk.white(config.serverId || 'nao configurado'));
    console.log(chalk.gray('  Canais:   ') + chalk.white(config.channels.length) + '\n');

    const { action } = await inquirer.prompt([{
      type: 'list', name: 'action', message: 'Opcao:',
      choices: [
        { name: 'Configurar servidor e canais', value: 'set' },
        { name: 'Inserir IDs de canais manualmente', value: 'manual' },
        { name: chalk.gray('← Voltar'), value: 'back' },
      ],
    }]);
    if (action === 'back') return;

    if (action === 'set') {
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
            console.log(chalk.green(`\n  ${channels.length} canal(is) de texto encontrado(s):\n`));
            channels.forEach((c, i) => console.log(chalk.gray(`  [${i+1}]`) + ` #${c.name} ` + chalk.gray(`(${c.id})`)));
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
            message: 'IDs dos canais (virgula):',
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

    if (action === 'manual') {
      const { manual } = await inquirer.prompt([{
        type: 'input', name: 'manual',
        message: 'IDs dos canais (separados por virgula):',
        default: config.channels.join(','),
      }]);
      config.channels = manual.split(',').map(s => s.trim()).filter(Boolean);
      cfg.save(config);
      log(`${config.channels.length} canal(is) salvos.`, 'ok');
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

// ─── 4. Mensagem & Midia ─────────────────────────────────────────────────────
async function menuMensagem(config) {
  while (true) {
    banner();
    console.log(chalk.yellow('  [ MENSAGEM & MIDIA ]\n'));
    console.log(chalk.gray('  Mensagem: ') + chalk.white(config.message || 'nao configurada'));
    console.log(chalk.gray('  Midia:    ') + chalk.white(config.mediaPath || 'nenhuma') + '\n');

    const { action } = await inquirer.prompt([{
      type: 'list', name: 'action', message: 'Opcao:',
      choices: [
        { name: 'Definir mensagem', value: 'msg' },
        { name: 'Definir midia (foto/video)', value: 'media' },
        { name: 'Remover midia', value: 'removemedia' },
        { name: chalk.gray('← Voltar'), value: 'back' },
      ],
    }]);
    if (action === 'back') return;

    if (action === 'msg') {
      const { msg } = await inquirer.prompt([{
        type: 'input', name: 'msg',
        message: 'Mensagem a enviar:',
        default: config.message || '',
      }]);
      config.message = msg.trim();
      cfg.save(config);
      log('Mensagem salva.', 'ok');
      await new Promise(r => setTimeout(r, 800));
    }

    if (action === 'media') {
      const { mediaPath } = await inquirer.prompt([{
        type: 'input', name: 'mediaPath',
        message: 'Caminho completo do arquivo (ex: C:\\fotos\\img.jpg):',
        default: config.mediaPath || '',
        validate: v => {
          if (!v.trim()) return 'Obrigatorio';
          if (!require('fs').existsSync(v.trim())) return 'Arquivo nao encontrado';
          return true;
        },
      }]);
      config.mediaPath = mediaPath.trim();
      cfg.save(config);
      log('Midia salva.', 'ok');
      await new Promise(r => setTimeout(r, 800));
    }

    if (action === 'removemedia') {
      config.mediaPath = '';
      cfg.save(config);
      log('Midia removida.', 'ok');
      await new Promise(r => setTimeout(r, 800));
    }
  }
}

// ─── 5. INICIAR ───────────────────────────────────────────────────────────────
async function menuIniciar(config) {
  banner();
  console.log(chalk.yellow('  [ INICIAR ENVIO — ROUND-ROBIN SEQUENCIAL ]\n'));

  const erros = [];
  if (!config.tokens.length)                erros.push('Sem tokens (opcao 1)');
  if (!config.serverId)                     erros.push('Sem servidor (opcao 3)');
  if (!config.channels.length)              erros.push('Sem canais (opcao 3)');
  if (!config.message && !config.mediaPath) erros.push('Sem mensagem ou midia (opcao 4)');

  if (erros.length) {
    erros.forEach(e => log(e, 'warn'));
    await pressEnter();
    return;
  }

  const tokens = config.tokens.slice(0, config.simultaneousUsers);

  console.log(chalk.gray('  Cada conta envia 1 mensagem → proxima conta → ciclo infinito\n'));
  console.log(`  ${chalk.cyan('Contas:   ')} ${tokens.length}`);
  console.log(`  ${chalk.cyan('Canais:   ')} ${config.channels.length}`);
  console.log(`  ${chalk.cyan('Mensagem: ')} ${config.message || chalk.gray('(so midia)')}`);
  console.log(`  ${chalk.cyan('Midia:    ')} ${config.mediaPath || chalk.gray('Nenhuma')}`);
  console.log(`  ${chalk.cyan('Modo:     ')} ${chalk.red('INFINITO')} — Ctrl+C para parar`);
  console.log('');

  const { confirm } = await inquirer.prompt([{
    type: 'confirm', name: 'confirm',
    message: chalk.red('Iniciar envio?'),
  }]);
  if (!confirm) return;

  console.log('');
  log('Enviando... Ctrl+C para parar.\n', 'info');

  let round = 0, total = 0, chanIdx = 0;

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
      log(`[Conta ${String(userNum).padStart(2)}] → canal ${channelId} | Total: ${chalk.white(total)}`, 'send');
    } catch (e) {
      const msg = e?.response?.data?.message || e.message;
      log(`[Conta ${String(userNum).padStart(2)}] Erro: ${msg}`, 'error');
      if (e?.response?.status === 429) {
        const wait = (e.response?.data?.retry_after || 2) * 1000;
        log(`Rate limit — aguardando ${wait/1000}s`, 'warn');
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
    }

    round++;
    if (round % tokens.length === 0) chanIdx++;
  }
}

// ─── STATUS ───────────────────────────────────────────────────────────────────
function showStatus(config) {
  const t  = config.tokens.length;
  const si = config.simultaneousUsers;
  const sv = config.serverId || chalk.red('nao config');
  const ch = config.channels.length;
  const mg = config.message
    ? (config.message.length > 30 ? config.message.substring(0,30)+'...' : config.message)
    : chalk.gray('nao config');
  const md = config.mediaPath ? chalk.green('sim') : chalk.gray('nao');

  const line = (label, val, padTo = 42) => {
    const content = `  ${label.padEnd(12)}${val}`;
    const raw = content.replace(/\x1B\[[0-9;]*m/g, '');
    return chalk.gray('  ║') + content + ' '.repeat(Math.max(0, padTo - raw.length)) + chalk.gray('║');
  };

  return [
    chalk.gray('  ╔════════════════════════════════════════════╗'),
    chalk.gray('  ║') + chalk.cyan('  STATUS PAINEL 141                        ') + chalk.gray('║'),
    chalk.gray('  ╠════════════════════════════════════════════╣'),
    line('Tokens:', `${chalk.white(t)}/100 | Ativas: ${chalk.white(si)}`),
    line('Servidor:', sv),
    line('Canais:', `${chalk.white(ch)} canal(is)`),
    line('Mensagem:', mg),
    line('Midia:', md),
    chalk.gray('  ╚════════════════════════════════════════════╝'),
    '',
  ].join('\n');
}

// ─── MENU PRINCIPAL ───────────────────────────────────────────────────────────
async function mainMenu() {
  let config = cfg.load();
  while (true) {
    banner();
    console.log(showStatus(config));

    const { option } = await inquirer.prompt([{
      type: 'list', name: 'option',
      message: chalk.white('Selecione:'),
      choices: [
        { name: `${chalk.cyan('1.')} Tokens (usuario / bot) — ate 100`, value: '1' },
        { name: `${chalk.cyan('2.')} Contas ativas (1–100)`,             value: '2' },
        { name: `${chalk.cyan('3.')} Servidor & Canais`,                  value: '3' },
        { name: `${chalk.cyan('4.')} Mensagem & Midia`,                   value: '4' },
        { name: `${chalk.red('►')} ${chalk.red('INICIAR ENVIO')}`,         value: '5' },
        new inquirer.Separator(),
        { name: chalk.gray('Sair'), value: '0' },
      ],
    }]);

    if (option === '0') { console.log(chalk.gray('\n  Encerrando Painel 141.\n')); process.exit(0); }
    if (option === '1') { await menuTokens(config);   config = cfg.load(); }
    if (option === '2') { await menuUsuarios(config); config = cfg.load(); }
    if (option === '3') { await menuServidor(config); config = cfg.load(); }
    if (option === '4') { await menuMensagem(config); config = cfg.load(); }
    if (option === '5') { await menuIniciar(config);  config = cfg.load(); }
  }
}

module.exports = { mainMenu };
