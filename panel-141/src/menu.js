'use strict';
const inquirer = require('inquirer');
const chalk    = require('chalk');
const { banner, log }  = require('./utils');
const { validateToken, getChannels, sendFile, loopConta } = require('./discord');
const cfg = require('./config');

async function pressEnter() {
  await inquirer.prompt([{ type: 'input', name: '_', message: 'Pressione Enter para voltar...' }]);
}

// ─── 1. TOKENS ────────────────────────────────────────────────────────────────
async function menuTokens(config) {
  while (true) {
    banner();
    console.log(chalk.yellow('  [ GERENCIAR TOKENS ]\n'));
    console.log(chalk.gray('  Suporta token de usuario e token de Bot do Discord'));
    console.log(chalk.gray('  Tokens salvos: ') + chalk.white(config.tokens.length) + '/100\n');

    const { acao } = await inquirer.prompt([{
      type: 'list', name: 'acao', message: 'Opcao:',
      choices: [
        { name: 'Adicionar tokens (cole 1 a 100 de uma vez)', value: 'add' },
        { name: 'Listar e validar tokens',                    value: 'listar' },
        { name: 'Limpar todos os tokens',                     value: 'limpar' },
        { name: chalk.gray('<- Voltar ao menu principal'),    value: 'voltar' },
      ],
    }]);

    if (acao === 'voltar') return;

    if (acao === 'add') {
      console.log(chalk.gray('\n  Cole todos os tokens separados por virgula.'));
      console.log(chalk.gray('  Exemplo: token1,token2,token3  (ate 100 tokens)\n'));

      const { raw } = await inquirer.prompt([{
        type: 'input', name: 'raw',
        message: 'Cole os tokens:',
      }]);

      const novos = raw.split(',').map(t => t.trim()).filter(Boolean);
      const antes = config.tokens.length;
      config.tokens = [...new Set([...config.tokens, ...novos])].slice(0, 100);
      cfg.save(config);
      console.log('');
      log(`${config.tokens.length - antes} token(s) adicionado(s). Total: ${config.tokens.length}/100`, 'ok');
      console.log('');
      await pressEnter();
    }

    if (acao === 'listar') {
      if (!config.tokens.length) {
        log('Nenhum token salvo ainda.', 'aviso');
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }
      console.log('');
      for (let i = 0; i < config.tokens.length; i++) {
        const curto = config.tokens[i].substring(0, 26) + '...';
        process.stdout.write(chalk.gray(`  [${String(i+1).padStart(2)}] ${curto} `));
        const { ok, user, error } = await validateToken(config.tokens[i]);
        if (ok) {
          const tag = (user.discriminator && user.discriminator !== '0')
            ? `${user.username}#${user.discriminator}` : user.username;
          console.log(chalk.green(`valido - ${tag}`));
        } else {
          console.log(chalk.red(`invalido - ${error}`));
        }
      }
      console.log('');
      await pressEnter();
    }

    if (acao === 'limpar') {
      const { conf } = await inquirer.prompt([{
        type: 'confirm', name: 'conf',
        message: chalk.red('Remover todos os tokens?'), default: false,
      }]);
      if (conf) {
        config.tokens = [];
        cfg.save(config);
        log('Todos os tokens foram removidos.', 'ok');
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }
}

// ─── 2. CONTAS ATIVAS ─────────────────────────────────────────────────────────
async function menuContas(config) {
  while (true) {
    banner();
    console.log(chalk.yellow('  [ CONTAS ATIVAS ]\n'));
    console.log(chalk.gray('  Tokens salvos:  ') + chalk.white(config.tokens.length));
    console.log(chalk.gray('  Contas ativas:  ') + chalk.white(config.simultaneousUsers) + '\n');

    const { acao } = await inquirer.prompt([{
      type: 'list', name: 'acao', message: 'Opcao:',
      choices: [
        { name: 'Definir quantidade de contas', value: 'definir' },
        { name: chalk.gray('<- Voltar ao menu principal'), value: 'voltar' },
      ],
    }]);
    if (acao === 'voltar') return;

    const max = config.tokens.length || 100;
    const { qtd } = await inquirer.prompt([{
      type: 'number', name: 'qtd',
      message: `Quantas contas enviam ao mesmo tempo? (1-${max}):`,
      validate: v => {
        if (!Number.isInteger(v) || v < 1) return 'Minimo 1';
        if (v > 100) return 'Maximo 100';
        if (config.tokens.length && v > config.tokens.length)
          return `Voce tem apenas ${config.tokens.length} token(s)`;
        return true;
      },
    }]);
    config.simultaneousUsers = qtd;
    cfg.save(config);
    log(`Contas ativas: ${qtd} — todas enviam ao mesmo tempo`, 'ok');
    await new Promise(r => setTimeout(r, 1200));
  }
}

// ─── 3. SERVIDOR & CANAIS ────────────────────────────────────────────────────
async function menuServidor(config) {
  while (true) {
    banner();
    console.log(chalk.yellow('  [ SERVIDOR & CANAIS ]\n'));
    console.log(chalk.gray('  Servidor: ') + chalk.white(config.serverId || 'nao configurado'));
    console.log(chalk.gray('  Canais:   ') + chalk.white(config.channels.length) + ' canal(is)\n');

    const { acao } = await inquirer.prompt([{
      type: 'list', name: 'acao', message: 'Opcao:',
      choices: [
        { name: 'Configurar servidor e buscar canais', value: 'buscar' },
        { name: 'Inserir IDs de canais manualmente',   value: 'manual' },
        { name: chalk.gray('<- Voltar ao menu principal'), value: 'voltar' },
      ],
    }]);
    if (acao === 'voltar') return;

    if (acao === 'buscar') {
      const { serverId } = await inquirer.prompt([{
        type: 'input', name: 'serverId',
        message: 'ID do servidor (Guild ID):',
        default: config.serverId,
        validate: v => v.trim() ? true : 'Campo obrigatorio',
      }]);
      config.serverId = serverId.trim();

      if (config.tokens.length) {
        log('Buscando canais de texto...', 'info');
        try {
          const canais = await getChannels(config.tokens[0], config.serverId);
          if (canais.length) {
            console.log(chalk.green(`\n  ${canais.length} canal(is) encontrado(s):\n`));
            canais.forEach((c, i) => console.log(chalk.gray(`  [${i+1}]`) + ` #${c.name} ` + chalk.gray(`(${c.id})`)));
            console.log('');
            const { sel } = await inquirer.prompt([{
              type: 'checkbox', name: 'sel',
              message: 'Selecione os canais de destino:',
              choices: canais.map(c => ({ name: `#${c.name}`, value: c.id })),
              validate: v => v.length ? true : 'Selecione ao menos 1 canal',
            }]);
            config.channels = sel;
          } else {
            log('Nenhum canal de texto encontrado neste servidor.', 'aviso');
            await new Promise(r => setTimeout(r, 2000));
          }
        } catch (e) {
          log(`Erro ao buscar canais: ${e.message}`, 'erro');
          await new Promise(r => setTimeout(r, 1500));
        }
      } else {
        log('Adicione ao menos um token antes de buscar canais.', 'aviso');
        await new Promise(r => setTimeout(r, 1800));
      }
      cfg.save(config);
      log(`Servidor e ${config.channels.length} canal(is) salvos.`, 'ok');
      await new Promise(r => setTimeout(r, 1000));
    }

    if (acao === 'manual') {
      const { manual } = await inquirer.prompt([{
        type: 'input', name: 'manual',
        message: 'IDs dos canais separados por virgula:',
        default: config.channels.join(','),
      }]);
      config.channels = manual.split(',').map(s => s.trim()).filter(Boolean);
      cfg.save(config);
      log(`${config.channels.length} canal(is) salvos.`, 'ok');
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

// ─── 4. MENSAGEM & MIDIA ─────────────────────────────────────────────────────
async function menuMensagem(config) {
  while (true) {
    banner();
    console.log(chalk.yellow('  [ MENSAGEM & MIDIA ]\n'));
    const msgExibida = config.message
      ? (config.message.length > 40 ? config.message.substring(0,40)+'...' : config.message)
      : chalk.gray('nao configurada');
    console.log(chalk.gray('  Mensagem: ') + chalk.white(msgExibida));
    console.log(chalk.gray('  Midia:    ') + chalk.white(config.mediaPath || chalk.gray('nenhuma')) + '\n');

    const { acao } = await inquirer.prompt([{
      type: 'list', name: 'acao', message: 'Opcao:',
      choices: [
        { name: 'Definir mensagem de texto',       value: 'msg' },
        { name: 'Definir midia (foto ou video)',   value: 'midia' },
        { name: 'Remover midia',                   value: 'remover' },
        { name: chalk.gray('<- Voltar ao menu principal'), value: 'voltar' },
      ],
    }]);
    if (acao === 'voltar') return;

    if (acao === 'msg') {
      const { msg } = await inquirer.prompt([{
        type: 'input', name: 'msg',
        message: 'Digite a mensagem:',
        default: config.message || '',
      }]);
      config.message = msg.trim();
      cfg.save(config);
      log('Mensagem salva.', 'ok');
      await new Promise(r => setTimeout(r, 800));
    }

    if (acao === 'midia') {
      const { mediaPath } = await inquirer.prompt([{
        type: 'input', name: 'mediaPath',
        message: 'Caminho do arquivo (ex: C:\\imagens\\foto.jpg):',
        default: config.mediaPath || '',
        validate: v => {
          if (!v.trim()) return 'Campo obrigatorio';
          if (!require('fs').existsSync(v.trim())) return 'Arquivo nao encontrado no caminho informado';
          return true;
        },
      }]);
      config.mediaPath = mediaPath.trim();
      cfg.save(config);
      log('Midia salva.', 'ok');
      await new Promise(r => setTimeout(r, 800));
    }

    if (acao === 'remover') {
      config.mediaPath = '';
      cfg.save(config);
      log('Midia removida.', 'ok');
      await new Promise(r => setTimeout(r, 800));
    }
  }
}

// ─── 5. INICIAR ENVIO — PARALELO ─────────────────────────────────────────────
async function menuIniciar(config) {
  banner();
  console.log(chalk.yellow('  [ INICIAR ENVIO ]\n'));

  const erros = [];
  if (!config.tokens.length)                erros.push('Sem tokens configurados (opcao 1)');
  if (!config.channels.length)              erros.push('Sem canais configurados (opcao 3)');
  if (!config.message && !config.mediaPath) erros.push('Sem mensagem ou midia (opcao 4)');

  if (erros.length) {
    erros.forEach(e => log(e, 'aviso'));
    console.log('');
    await pressEnter();
    return;
  }

  const tokens = config.tokens.slice(0, config.simultaneousUsers);

  console.log(chalk.gray('  Todas as contas enviam ao mesmo tempo (paralelo)\n'));
  console.log(`  ${chalk.cyan('Contas enviando:')} ${tokens.length}`);
  console.log(`  ${chalk.cyan('Canais alvo:    ')} ${config.channels.length}`);
  console.log(`  ${chalk.cyan('Mensagem:       ')} ${config.message || chalk.gray('(somente midia)')}`);
  console.log(`  ${chalk.cyan('Midia:          ')} ${config.mediaPath || chalk.gray('Nenhuma')}`);
  console.log(`  ${chalk.cyan('Velocidade:     ')} ${chalk.red('MAXIMA')} — sem delay artificial`);
  console.log(`  ${chalk.cyan('Modo:           ')} ${chalk.red('INFINITO')} — Ctrl+C para parar`);
  console.log('');

  const { confirmar } = await inquirer.prompt([{
    type: 'confirm', name: 'confirmar',
    message: chalk.red('Iniciar envio em paralelo?'),
  }]);
  if (!confirmar) return;

  console.log('');
  log(`Iniciando ${tokens.length} conta(s) em paralelo. Ctrl+C para encerrar.\n`, 'info');

  // Contador global compartilhado entre todas as contas
  let totalEnviados = 0;

  // Inicia um loop por conta — todos rodam ao mesmo tempo
  const loops = tokens.map((token, idx) =>
    loopConta({
      token,
      channels: config.channels,
      message:  config.message,
      mediaPath: config.mediaPath,
      contaNum: idx + 1,
      onSend: (conta, count, canalId) => {
        totalEnviados++;
        log(
          `Conta ${String(conta).padStart(2)} -> canal ${canalId} | ` +
          `enviados: ${chalk.white(totalEnviados)}`,
          'envio'
        );
      },
      onError: (conta, msg) => {
        log(`Conta ${String(conta).padStart(2)} erro: ${msg}`, 'erro');
      },
    })
  );

  // Aguarda todos (infinitamente, ate Ctrl+C)
  await Promise.all(loops);
}

// ─── STATUS ───────────────────────────────────────────────────────────────────
function exibirStatus(config) {
  const t  = config.tokens.length;
  const si = config.simultaneousUsers;
  const sv = config.serverId || chalk.red('nao configurado');
  const ch = config.channels.length;
  const mg = config.message
    ? (config.message.length > 28 ? config.message.substring(0,28)+'...' : config.message)
    : chalk.gray('nao configurada');
  const md = config.mediaPath ? chalk.green('sim') : chalk.gray('nao');

  const linha = (label, val) => {
    const conteudo = `  ${label.padEnd(14)}${val}`;
    const raw = conteudo.replace(/\x1B\[[0-9;]*m/g, '');
    const pad = Math.max(0, 44 - raw.length);
    return chalk.gray('  |') + conteudo + ' '.repeat(pad) + chalk.gray('|');
  };

  return [
    chalk.gray('  +==========================================+'),
    chalk.gray('  |') + chalk.cyan('  STATUS PAINEL 141                       ') + chalk.gray('|'),
    chalk.gray('  +==========================================+'),
    linha('Tokens:', `${chalk.white(t)}/100  Ativas: ${chalk.white(si)}`),
    linha('Servidor:', sv),
    linha('Canais:', `${chalk.white(ch)} canal(is)`),
    linha('Mensagem:', mg),
    linha('Midia:', md),
    chalk.gray('  +==========================================+'),
    '',
  ].join('\n');
}

// ─── MENU PRINCIPAL ───────────────────────────────────────────────────────────
async function menuPrincipal() {
  let config = cfg.load();
  while (true) {
    banner();
    console.log(exibirStatus(config));

    const { opcao } = await inquirer.prompt([{
      type: 'list', name: 'opcao',
      message: chalk.white('Selecione uma opcao:'),
      choices: [
        { name: `${chalk.cyan('1.')} Tokens (usuario / bot) — ate 100`,    value: '1' },
        { name: `${chalk.cyan('2.')} Contas ativas (envio simultaneo)`,     value: '2' },
        { name: `${chalk.cyan('3.')} Servidor e Canais`,                    value: '3' },
        { name: `${chalk.cyan('4.')} Mensagem e Midia`,                     value: '4' },
        { name: `${chalk.red('>')}  ${chalk.red.bold('INICIAR ENVIO')}`,    value: '5' },
        new inquirer.Separator(),
        { name: chalk.gray('Sair'), value: '0' },
      ],
    }]);

    if (opcao === '0') {
      console.log(chalk.gray('\n  Painel 141 encerrado.\n'));
      process.exit(0);
    }
    if (opcao === '1') { await menuTokens(config);   config = cfg.load(); }
    if (opcao === '2') { await menuContas(config);   config = cfg.load(); }
    if (opcao === '3') { await menuServidor(config); config = cfg.load(); }
    if (opcao === '4') { await menuMensagem(config); config = cfg.load(); }
    if (opcao === '5') { await menuIniciar(config);  config = cfg.load(); }
  }
}

module.exports = { mainMenu: menuPrincipal };
