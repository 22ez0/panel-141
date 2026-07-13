'use strict';
const inquirer = require('inquirer');
const chalk    = require('chalk');
const { banner, log }  = require('./utils');
const { voltou }       = require('./goback');
const { validateToken, getChannels, loopConta } = require('./discord');
const cfg = require('./config');

// ─── helpers ─────────────────────────────────────────────────────────────────
async function prompt(questions) {
  return inquirer.prompt(questions);
}

async function pressEnter() {
  await prompt([{ type: 'input', name: '_', message: 'Pressione Enter para continuar...' }]);
}

// ─── 1. TOKENS ────────────────────────────────────────────────────────────────
async function menuTokens(config) {
  while (true) {
    banner();
    console.log(chalk.yellow('  [ 1. GERENCIAR TOKENS ]\n'));
    console.log(chalk.gray('  Tokens salvos: ') + chalk.white(config.tokens.length) + '/100');
    console.log(chalk.gray('  Ctrl+N = voltar\n'));

    const { acao } = await prompt([{
      type: 'list', name: 'acao', message: 'Opcao:',
      choices: [
        { name: chalk.gray('<- Voltar ao menu principal'),    value: 'voltar' },
        { name: 'Adicionar tokens (cole ate 100 de uma vez)', value: 'add' },
        { name: 'Listar e validar tokens',                    value: 'listar' },
        { name: 'Limpar todos os tokens',                     value: 'limpar' },
      ],
    }]);

    if (acao === 'voltar' || voltou()) return;

    if (acao === 'add') {
      console.log(chalk.gray('\n  Cole os tokens separados por virgula.'));
      console.log(chalk.gray('  Exemplo: token1,token2,token3'));
      console.log(chalk.gray('  Deixe vazio e Enter para cancelar.\n'));

      const { raw } = await prompt([{
        type: 'input', name: 'raw',
        message: 'Tokens:',
      }]);
      if (voltou() || !raw.trim()) { log('Nenhum token adicionado.', 'aviso'); await new Promise(r => setTimeout(r, 800)); continue; }

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
        await new Promise(r => setTimeout(r, 1200));
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
          console.log(chalk.green(`valido  - ${tag}`));
        } else {
          console.log(chalk.red(`invalido - ${error}`));
        }
      }
      console.log('');
      await pressEnter();
      if (voltou()) return;
    }

    if (acao === 'limpar') {
      const { conf } = await prompt([{
        type: 'confirm', name: 'conf',
        message: chalk.red('Remover todos os tokens?'), default: false,
      }]);
      if (voltou()) return;
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
    console.log(chalk.yellow('  [ 2. CONTAS ATIVAS ]\n'));
    console.log(chalk.gray('  Tokens salvos:  ') + chalk.white(config.tokens.length));
    console.log(chalk.gray('  Contas ativas:  ') + chalk.white(config.simultaneousUsers));
    console.log(chalk.gray('  Ctrl+N = voltar\n'));

    const { acao } = await prompt([{
      type: 'list', name: 'acao', message: 'Opcao:',
      choices: [
        { name: chalk.gray('<- Voltar ao menu principal'), value: 'voltar' },
        { name: 'Definir quantidade de contas',            value: 'definir' },
      ],
    }]);
    if (acao === 'voltar' || voltou()) return;

    const max = config.tokens.length || 100;
    const { qtd } = await prompt([{
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
    if (voltou()) return;
    config.simultaneousUsers = qtd;
    cfg.save(config);
    log(`Contas ativas: ${qtd} — enviam todas ao mesmo tempo`, 'ok');
    await new Promise(r => setTimeout(r, 1000));
  }
}

// ─── 3. SERVIDOR & CANAIS ────────────────────────────────────────────────────
async function menuServidor(config) {
  while (true) {
    banner();
    console.log(chalk.yellow('  [ 3. SERVIDOR & CANAIS ]\n'));
    console.log(chalk.gray('  Servidor: ') + chalk.white(config.serverId || 'nao configurado'));
    console.log(chalk.gray('  Canais:   ') + chalk.white(config.channels.length) + ' canal(is)');
    console.log(chalk.gray('  Ctrl+N = voltar\n'));

    const { acao } = await prompt([{
      type: 'list', name: 'acao', message: 'Opcao:',
      choices: [
        { name: chalk.gray('<- Voltar ao menu principal'),       value: 'voltar' },
        { name: 'Configurar servidor e buscar canais',           value: 'buscar' },
        { name: 'Inserir IDs de canais manualmente',             value: 'manual' },
      ],
    }]);
    if (acao === 'voltar' || voltou()) return;

    if (acao === 'buscar') {
      const { serverId } = await prompt([{
        type: 'input', name: 'serverId',
        message: 'ID do servidor (Guild ID):',
        default: config.serverId,
      }]);
      if (voltou() || !serverId.trim()) continue;
      config.serverId = serverId.trim();

      if (config.tokens.length) {
        log('Buscando canais de texto...', 'info');
        try {
          const canais = await getChannels(config.tokens[0], config.serverId);
          if (canais.length) {
            console.log(chalk.green(`\n  ${canais.length} canal(is) encontrado(s):\n`));
            canais.forEach((c, i) => console.log(chalk.gray(`  [${i+1}]`) + ` #${c.name} ` + chalk.gray(`(${c.id})`)));
            console.log('');
            const { sel } = await prompt([{
              type: 'checkbox', name: 'sel',
              message: 'Selecione os canais de destino (Espaco = marcar, Enter = confirmar):',
              choices: canais.map(c => ({ name: `#${c.name}`, value: c.id })),
            }]);
            if (voltou()) return;
            if (sel.length) config.channels = sel;
          } else {
            log('Nenhum canal de texto encontrado.', 'aviso');
            await new Promise(r => setTimeout(r, 1500));
          }
        } catch (e) {
          log(`Erro ao buscar canais: ${e.message}`, 'erro');
          await new Promise(r => setTimeout(r, 1500));
        }
      } else {
        log('Adicione ao menos um token antes de buscar canais.', 'aviso');
        await new Promise(r => setTimeout(r, 1500));
      }
      cfg.save(config);
      if (config.channels.length) log(`${config.channels.length} canal(is) salvos.`, 'ok');
      await new Promise(r => setTimeout(r, 800));
    }

    if (acao === 'manual') {
      const { manual } = await prompt([{
        type: 'input', name: 'manual',
        message: 'IDs dos canais separados por virgula:',
        default: config.channels.join(','),
      }]);
      if (voltou()) return;
      config.channels = manual.split(',').map(s => s.trim()).filter(Boolean);
      cfg.save(config);
      log(`${config.channels.length} canal(is) salvos.`, 'ok');
      await new Promise(r => setTimeout(r, 800));
    }
  }
}

// ─── 4. MENSAGEM & MIDIA ─────────────────────────────────────────────────────
async function menuMensagem(config) {
  while (true) {
    banner();
    console.log(chalk.yellow('  [ 4. MENSAGEM & MIDIA ]\n'));
    const msgExibida = config.message
      ? (config.message.length > 38 ? config.message.substring(0, 38) + '...' : config.message)
      : chalk.gray('nao configurada');
    console.log(chalk.gray('  Mensagem:  ') + chalk.white(msgExibida));
    console.log(chalk.gray('  Midias:    ') + chalk.white(config.mediaUrls.length) + ' URL(s) cadastrada(s)');
    console.log(chalk.gray('  Ctrl+N = voltar\n'));

    const { acao } = await prompt([{
      type: 'list', name: 'acao', message: 'Opcao:',
      choices: [
        { name: chalk.gray('<- Voltar ao menu principal'),                        value: 'voltar' },
        { name: 'Definir mensagem de texto',                                      value: 'msg' },
        { name: 'Adicionar URLs de midia (Discord CDN, imgur, etc.)',             value: 'addurl' },
        { name: `Listar URLs cadastradas (${config.mediaUrls.length})`,           value: 'listar' },
        { name: 'Remover todas as midias',                                        value: 'remover' },
      ],
    }]);
    if (acao === 'voltar' || voltou()) return;

    if (acao === 'msg') {
      console.log(chalk.gray('\n  Deixe vazio para enviar somente midia.\n'));
      const { msg } = await prompt([{
        type: 'input', name: 'msg',
        message: 'Mensagem de texto:',
        default: config.message || '',
      }]);
      if (voltou()) return;
      config.message = msg.trim();
      cfg.save(config);
      log('Mensagem salva.', 'ok');
      await new Promise(r => setTimeout(r, 700));
    }

    if (acao === 'addurl') {
      console.log(chalk.gray('\n  Cole as URLs separadas por virgula.'));
      console.log(chalk.gray('  No Discord: clique com botao direito na imagem -> "Copiar link"'));
      console.log(chalk.gray('  Aceita: discord CDN, imgur, etc. ou caminho de arquivo local.'));
      console.log(chalk.gray('  Deixe vazio e Enter para cancelar.\n'));

      const { raw } = await prompt([{
        type: 'input', name: 'raw',
        message: 'URLs (separadas por virgula):',
      }]);
      if (voltou() || !raw.trim()) continue;

      const novas = raw.split(',').map(u => u.trim()).filter(Boolean);
      const antes = config.mediaUrls.length;
      config.mediaUrls = [...new Set([...config.mediaUrls, ...novas])];
      cfg.save(config);
      console.log('');
      log(`${config.mediaUrls.length - antes} URL(s) adicionada(s). Total: ${config.mediaUrls.length}`, 'ok');
      console.log('');
      await pressEnter();
      if (voltou()) return;
    }

    if (acao === 'listar') {
      if (!config.mediaUrls.length) {
        log('Nenhuma URL cadastrada.', 'aviso');
        await new Promise(r => setTimeout(r, 1200));
        continue;
      }
      console.log('');
      config.mediaUrls.forEach((url, i) => {
        const curta = url.length > 60 ? url.substring(0, 60) + '...' : url;
        console.log(chalk.gray(`  [${String(i+1).padStart(2)}]`) + ' ' + chalk.white(curta));
      });
      console.log('');
      await pressEnter();
      if (voltou()) return;
    }

    if (acao === 'remover') {
      const { conf } = await prompt([{
        type: 'confirm', name: 'conf',
        message: chalk.red('Remover todas as URLs de midia?'), default: false,
      }]);
      if (voltou()) return;
      if (conf) {
        config.mediaUrls = [];
        cfg.save(config);
        log('Midias removidas.', 'ok');
        await new Promise(r => setTimeout(r, 700));
      }
    }
  }
}

// ─── 5. INICIAR ENVIO ────────────────────────────────────────────────────────
async function menuIniciar(config) {
  banner();
  console.log(chalk.yellow('  [ INICIAR ENVIO ]\n'));

  const erros = [];
  if (!config.tokens.length)                          erros.push('Sem tokens configurados   (opcao 1)');
  if (!config.channels.length)                        erros.push('Sem canais configurados   (opcao 3)');
  if (!config.message && !config.mediaUrls.length)    erros.push('Sem mensagem ou midia     (opcao 4)');

  if (erros.length) {
    console.log(chalk.red('  Configuracao incompleta:\n'));
    erros.forEach(e => log(e, 'aviso'));
    console.log('');
    await pressEnter();
    return;
  }

  const tokens = config.tokens.slice(0, config.simultaneousUsers);

  console.log(chalk.gray('  Todas as contas enviam ao mesmo tempo (paralelo)\n'));
  console.log(`  ${chalk.cyan('Contas ativas: ')} ${tokens.length}`);
  console.log(`  ${chalk.cyan('Canais alvo:   ')} ${config.channels.length}`);
  console.log(`  ${chalk.cyan('Mensagem:      ')} ${config.message || chalk.gray('(somente midia)')}`);
  console.log(`  ${chalk.cyan('Midias:        ')} ${config.mediaUrls.length} URL(s) ${config.mediaUrls.length > 1 ? chalk.gray('(ciclo round-robin)') : ''}`);
  console.log(`  ${chalk.cyan('Velocidade:    ')} ${chalk.red('MAXIMA')} — sem delay artificial`);
  console.log(`  ${chalk.cyan('Modo:          ')} ${chalk.red('INFINITO')} — Ctrl+C para parar`);
  console.log('');

  const { confirmar } = await prompt([{
    type: 'confirm', name: 'confirmar',
    message: chalk.red('Iniciar envio em paralelo?'),
  }]);
  if (voltou() || !confirmar) return;

  console.log('');
  log(`Iniciando ${tokens.length} conta(s) em paralelo. Ctrl+C para encerrar.\n`, 'info');

  let totalEnviados = 0;

  const loops = tokens.map((token, idx) =>
    loopConta({
      token,
      channels:  config.channels,
      message:   config.message,
      mediaUrls: config.mediaUrls,
      contaNum:  idx + 1,
      onSend: (conta, count, canalId) => {
        totalEnviados++;
        log(
          `Conta ${String(conta).padStart(2)} -> canal ${canalId} | total: ${chalk.white(totalEnviados)}`,
          'envio'
        );
      },
      onError: (conta, msg) => {
        log(`Conta ${String(conta).padStart(2)} erro: ${msg}`, 'erro');
      },
    })
  );

  await Promise.all(loops);
}

// ─── STATUS ───────────────────────────────────────────────────────────────────
function exibirStatus(config) {
  const linha = (label, val) => {
    const conteudo = `  ${label.padEnd(12)}${val}`;
    const raw = conteudo.replace(/\x1B\[[0-9;]*m/g, '');
    const pad = ' '.repeat(Math.max(0, 44 - raw.length));
    return chalk.gray('  |') + conteudo + pad + chalk.gray('|');
  };

  const msgStr = config.message
    ? (config.message.length > 26 ? config.message.substring(0, 26) + '...' : config.message)
    : chalk.gray('nao configurada');

  return [
    chalk.gray('  +==========================================+'),
    chalk.gray('  |') + chalk.cyan('  STATUS ATUAL                            ') + chalk.gray('|'),
    chalk.gray('  +==========================================+'),
    linha('Tokens:',   `${chalk.white(config.tokens.length)}/100  Ativas: ${chalk.white(config.simultaneousUsers)}`),
    linha('Servidor:', config.serverId || chalk.red('nao configurado')),
    linha('Canais:',   `${chalk.white(config.channels.length)} canal(is)`),
    linha('Mensagem:', msgStr),
    linha('Midias:',   `${chalk.white(config.mediaUrls.length)} URL(s) cadastrada(s)`),
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

    const { opcao } = await prompt([{
      type: 'list', name: 'opcao',
      message: chalk.white('Selecione:'),
      choices: [
        { name: `${chalk.cyan('1.')} Tokens (usuario / bot)  — ate 100`,  value: '1' },
        { name: `${chalk.cyan('2.')} Contas ativas`,                       value: '2' },
        { name: `${chalk.cyan('3.')} Servidor e Canais`,                   value: '3' },
        { name: `${chalk.cyan('4.')} Mensagem e Midia (URLs)`,             value: '4' },
        { name: `${chalk.red('>')} ${chalk.red.bold('INICIAR ENVIO')}`,   value: '5' },
        new inquirer.Separator(),
        { name: chalk.gray('Sair'), value: '0' },
      ],
    }]);

    if (voltou()) continue; // Ctrl+N no menu principal nao faz nada
    if (opcao === '0') { console.log(chalk.gray('\n  Painel 141 encerrado.\n')); process.exit(0); }
    if (opcao === '1') { await menuTokens(config);   config = cfg.load(); }
    if (opcao === '2') { await menuContas(config);   config = cfg.load(); }
    if (opcao === '3') { await menuServidor(config); config = cfg.load(); }
    if (opcao === '4') { await menuMensagem(config); config = cfg.load(); }
    if (opcao === '5') { await menuIniciar(config);  config = cfg.load(); }
  }
}

module.exports = { mainMenu: menuPrincipal };
