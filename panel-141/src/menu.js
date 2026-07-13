'use strict';
const inquirer = require('inquirer');
const chalk    = require('chalk');
const { banner, log }  = require('./utils');
const { voltou }       = require('./goback');
const { validateToken, getChannels, loopConta } = require('./discord');
const { abrir, atualizarPresenca, entrarVoz, sairVoz, fecharTodos } = require('./gateway');
const { usernameAleatorio, emailAleatorio, senhaAleatoria,
        registrarConta, atualizarFoto, atualizarBio, atualizarStatus, salvarTokensTxt } = require('./accounts');
const { entrarServidor } = require('./discord');
const cfg = require('./config');

async function pressEnter() {
  await inquirer.prompt([{ type: 'input', name: '_', message: 'Pressione Enter para continuar...' }]);
}

// ─── 1. TOKENS ────────────────────────────────────────────────────────────────
async function menuTokens(config) {
  while (true) {
    banner();
    console.log(chalk.yellow('  [ 1. TOKENS ]\n'));
    console.log(chalk.gray('  Salvos: ') + chalk.white(config.tokens.length) + '/100\n');

    const { acao } = await inquirer.prompt([{
      type: 'list', name: 'acao', message: 'Opcao:',
      choices: [
        { name: chalk.gray('<- Voltar'), value: 'voltar' },
        { name: 'Adicionar tokens (ate 100, separados por virgula)', value: 'add' },
        { name: 'Listar e validar tokens', value: 'listar' },
        { name: 'Limpar todos', value: 'limpar' },
      ],
    }]);
    if (acao === 'voltar' || voltou()) return;

    if (acao === 'add') {
      console.log(chalk.gray('\n  Cole os tokens separados por virgula. Vazio = cancelar.\n'));
      const { raw } = await inquirer.prompt([{ type: 'input', name: 'raw', message: 'Tokens:' }]);
      if (voltou() || !raw.trim()) continue;
      const novos = raw.split(',').map(t => t.trim()).filter(Boolean);
      const antes = config.tokens.length;
      config.tokens = [...new Set([...config.tokens, ...novos])].slice(0, 100);
      cfg.save(config);
      log(`${config.tokens.length - antes} adicionado(s). Total: ${config.tokens.length}/100`, 'ok');
      await pressEnter();
      if (voltou()) return;
    }

    if (acao === 'listar') {
      if (!config.tokens.length) { log('Nenhum token salvo.', 'aviso'); await new Promise(r => setTimeout(r, 1200)); continue; }
      console.log('');
      for (let i = 0; i < config.tokens.length; i++) {
        process.stdout.write(chalk.gray(`  [${String(i+1).padStart(2)}] ${config.tokens[i].substring(0,24)}... `));
        const { ok, user, error } = await validateToken(config.tokens[i]);
        console.log(ok ? chalk.green(`valido - ${user.username}`) : chalk.red(`invalido - ${error}`));
      }
      console.log('');
      await pressEnter();
      if (voltou()) return;
    }

    if (acao === 'limpar') {
      const { conf } = await inquirer.prompt([{ type: 'confirm', name: 'conf', message: chalk.red('Remover tudo?'), default: false }]);
      if (voltou()) return;
      if (conf) { config.tokens = []; cfg.save(config); log('Tokens removidos.', 'ok'); await new Promise(r => setTimeout(r, 800)); }
    }
  }
}

// ─── 2. CONTAS ATIVAS ─────────────────────────────────────────────────────────
async function menuContas(config) {
  while (true) {
    banner();
    console.log(chalk.yellow('  [ 2. CONTAS ATIVAS ]\n'));
    console.log(chalk.gray('  Tokens: ') + chalk.white(config.tokens.length) + '  Ativas: ' + chalk.white(config.simultaneousUsers) + '\n');

    const { acao } = await inquirer.prompt([{
      type: 'list', name: 'acao', message: 'Opcao:',
      choices: [
        { name: chalk.gray('<- Voltar'), value: 'voltar' },
        { name: 'Definir quantidade de contas ativas', value: 'definir' },
      ],
    }]);
    if (acao === 'voltar' || voltou()) return;

    const max = config.tokens.length || 100;
    const { qtd } = await inquirer.prompt([{
      type: 'number', name: 'qtd',
      message: `Quantas contas enviam ao mesmo tempo? (1-${max}):`,
      validate: v => Number.isInteger(v) && v >= 1 && v <= 100 ? true : 'Entre 1 e 100',
    }]);
    if (voltou()) return;
    config.simultaneousUsers = qtd;
    cfg.save(config);
    log(`Contas ativas: ${qtd}`, 'ok');
    await new Promise(r => setTimeout(r, 800));
  }
}

// ─── 3. SERVIDOR & CANAIS ────────────────────────────────────────────────────
async function menuServidor(config) {
  while (true) {
    banner();
    console.log(chalk.yellow('  [ 3. SERVIDOR & CANAIS ]\n'));
    console.log(chalk.gray('  Servidor: ') + chalk.white(config.serverId || 'nao config'));
    console.log(chalk.gray('  Canais:   ') + chalk.white(config.channels.length) + '\n');

    const { acao } = await inquirer.prompt([{
      type: 'list', name: 'acao', message: 'Opcao:',
      choices: [
        { name: chalk.gray('<- Voltar'), value: 'voltar' },
        { name: 'Buscar canais do servidor', value: 'buscar' },
        { name: 'Inserir IDs manualmente',   value: 'manual' },
      ],
    }]);
    if (acao === 'voltar' || voltou()) return;

    if (acao === 'buscar') {
      const { sid } = await inquirer.prompt([{ type: 'input', name: 'sid', message: 'ID do servidor:', default: config.serverId }]);
      if (voltou() || !sid.trim()) continue;
      config.serverId = sid.trim();
      if (config.tokens.length) {
        try {
          const canais = await getChannels(config.tokens[0], config.serverId);
          if (canais.length) {
            const { sel } = await inquirer.prompt([{
              type: 'checkbox', name: 'sel',
              message: 'Selecione canais de texto:',
              choices: canais.map(c => ({ name: `#${c.name}`, value: c.id })),
            }]);
            if (voltou()) return;
            if (sel.length) config.channels = sel;
          }
        } catch (e) { log(`Erro: ${e.message}`, 'erro'); await new Promise(r => setTimeout(r, 1500)); }
      }
      cfg.save(config);
      log('Salvo.', 'ok');
      await new Promise(r => setTimeout(r, 700));
    }

    if (acao === 'manual') {
      const { ids } = await inquirer.prompt([{ type: 'input', name: 'ids', message: 'IDs de canais (virgula):', default: config.channels.join(',') }]);
      if (voltou()) return;
      config.channels = ids.split(',').map(s => s.trim()).filter(Boolean);
      cfg.save(config);
      log(`${config.channels.length} canal(is) salvos.`, 'ok');
      await new Promise(r => setTimeout(r, 700));
    }
  }
}

// ─── 4. MENSAGEM & MIDIA ─────────────────────────────────────────────────────
async function menuMensagem(config) {
  while (true) {
    banner();
    console.log(chalk.yellow('  [ 4. MENSAGEM & MIDIA ]\n'));
    const ms = config.message || chalk.gray('nao config');
    console.log(chalk.gray('  Mensagem: ') + chalk.white(ms));
    console.log(chalk.gray('  Midias:   ') + chalk.white(config.mediaUrls.length) + ' URL(s)\n');

    const { acao } = await inquirer.prompt([{
      type: 'list', name: 'acao', message: 'Opcao:',
      choices: [
        { name: chalk.gray('<- Voltar'), value: 'voltar' },
        { name: 'Definir mensagem de texto', value: 'msg' },
        { name: 'Adicionar URLs de midia (Discord CDN, imgur, etc.)', value: 'addurl' },
        { name: `Listar URLs (${config.mediaUrls.length})`, value: 'listar' },
        { name: 'Remover todas as midias', value: 'remover' },
      ],
    }]);
    if (acao === 'voltar' || voltou()) return;

    if (acao === 'msg') {
      const { msg } = await inquirer.prompt([{ type: 'input', name: 'msg', message: 'Mensagem:', default: config.message }]);
      if (voltou()) return;
      config.message = msg.trim();
      cfg.save(config);
      log('Salvo.', 'ok');
      await new Promise(r => setTimeout(r, 600));
    }

    if (acao === 'addurl') {
      console.log(chalk.gray('\n  Discord: botao direito na imagem -> Copiar link\n'));
      const { raw } = await inquirer.prompt([{ type: 'input', name: 'raw', message: 'URLs (virgula):' }]);
      if (voltou() || !raw.trim()) continue;
      const novas = raw.split(',').map(u => u.trim()).filter(Boolean);
      const antes = config.mediaUrls.length;
      config.mediaUrls = [...new Set([...config.mediaUrls, ...novas])];
      cfg.save(config);
      log(`${config.mediaUrls.length - antes} URL(s) adicionada(s). Total: ${config.mediaUrls.length}`, 'ok');
      await pressEnter();
      if (voltou()) return;
    }

    if (acao === 'listar') {
      config.mediaUrls.forEach((u, i) => console.log(chalk.gray(`  [${i+1}]`) + ' ' + (u.length > 70 ? u.slice(0,70)+'...' : u)));
      console.log('');
      await pressEnter();
      if (voltou()) return;
    }

    if (acao === 'remover') {
      const { conf } = await inquirer.prompt([{ type: 'confirm', name: 'conf', message: chalk.red('Remover todas as midias?'), default: false }]);
      if (voltou()) return;
      if (conf) { config.mediaUrls = []; cfg.save(config); log('Removido.', 'ok'); await new Promise(r => setTimeout(r, 600)); }
    }
  }
}

// ─── 5. PERSONALIZAR CONTAS ──────────────────────────────────────────────────
async function menuPersonalizar(config) {
  while (true) {
    banner();
    console.log(chalk.yellow('  [ 5. PERSONALIZAR CONTAS ]\n'));
    console.log(chalk.gray('  Aplica nas ') + chalk.white(Math.min(config.tokens.length, config.simultaneousUsers)) + chalk.gray(' conta(s) ativa(s)\n'));

    const { acao } = await inquirer.prompt([{
      type: 'list', name: 'acao', message: 'Opcao:',
      choices: [
        { name: chalk.gray('<- Voltar'), value: 'voltar' },
        { name: 'Mudar foto de perfil (URL ou caminho de arquivo)', value: 'foto' },
        { name: 'Mudar bio de todas as contas',                     value: 'bio' },
        { name: 'Ativar Streaming (RPC roxo) em todas',             value: 'stream' },
        { name: 'Colocar todas as contas como Invisivel',           value: 'invis' },
        { name: 'Colocar todas as contas como Online',              value: 'online' },
        { name: 'Definir URL e titulo do streaming',                value: 'cfgstream' },
      ],
    }]);
    if (acao === 'voltar' || voltou()) return;

    const tokens = config.tokens.slice(0, config.simultaneousUsers);
    if (!tokens.length) { log('Nenhum token configurado.', 'aviso'); await new Promise(r => setTimeout(r, 1200)); continue; }

    if (acao === 'foto') {
      console.log(chalk.gray('\n  Cole uma URL de imagem ou caminho local.\n'));
      const { fotoUrl } = await inquirer.prompt([{ type: 'input', name: 'fotoUrl', message: 'URL ou caminho:', default: config.fotoUrl }]);
      if (voltou() || !fotoUrl.trim()) continue;
      config.fotoUrl = fotoUrl.trim();
      cfg.save(config);
      let ok = 0, err = 0;
      for (const token of tokens) {
        try { await atualizarFoto(token, config.fotoUrl); ok++; log(`Foto atualizada (${ok}/${tokens.length})`, 'ok'); }
        catch (e) { err++; log(`Erro foto: ${e?.response?.data?.message || e.message}`, 'erro'); }
        await new Promise(r => setTimeout(r, 800));
      }
      log(`Concluido: ${ok} ok, ${err} erro(s)`, ok > 0 ? 'ok' : 'erro');
      await pressEnter();
      if (voltou()) return;
    }

    if (acao === 'bio') {
      const { bio } = await inquirer.prompt([{ type: 'input', name: 'bio', message: 'Nova bio:', default: config.bio }]);
      if (voltou()) return;
      config.bio = bio;
      cfg.save(config);
      let ok = 0, err = 0;
      for (const token of tokens) {
        try { await atualizarBio(token, bio); ok++; log(`Bio atualizada (${ok}/${tokens.length})`, 'ok'); }
        catch (e) { err++; log(`Erro bio: ${e?.response?.data?.message || e.message}`, 'erro'); }
        await new Promise(r => setTimeout(r, 600));
      }
      log(`Concluido: ${ok} ok, ${err} erro(s)`, ok > 0 ? 'ok' : 'erro');
      await pressEnter();
      if (voltou()) return;
    }

    if (acao === 'stream') {
      if (!config.streamUrl || !config.streamUrl.includes('twitch.tv/')) {
        log('Configure a URL do streaming primeiro (Definir URL e titulo).', 'aviso');
        log('Precisa ser twitch.tv/SEU_CANAL — ex: https://www.twitch.tv/xqc', 'aviso');
        await new Promise(r => setTimeout(r, 2000)); continue;
      }
      log(`Conectando ${tokens.length} conta(s) ao gateway para streaming RPC...`, 'info');
      let ok = 0;
      for (const token of tokens) {
        try {
          await abrir(token, { status: 'online', streaming: true, streamUrl: config.streamUrl, streamTitle: config.streamTitulo });
          ok++;
          log(`Conta ${ok}/${tokens.length} streaming ativo`, 'ok');
        } catch (e) { log(`Erro gateway: ${e.message}`, 'erro'); }
        await new Promise(r => setTimeout(r, 400));
      }
      log(`Streaming ativo em ${ok} conta(s). NAO feche o painel.`, 'ok');
      await pressEnter();
      if (voltou()) return;
    }

    if (acao === 'invis') {
      let ok = 0;
      for (const token of tokens) {
        try { await atualizarStatus(token, 'invisible'); ok++; log(`Invisivel (${ok}/${tokens.length})`, 'ok'); }
        catch (e) { log(`Erro: ${e?.response?.data?.message || e.message}`, 'erro'); }
        await new Promise(r => setTimeout(r, 500));
      }
      log(`${ok} conta(s) agora invisiveis.`, 'ok');
      await pressEnter();
      if (voltou()) return;
    }

    if (acao === 'online') {
      let ok = 0;
      for (const token of tokens) {
        try { await atualizarStatus(token, 'online'); ok++; log(`Online (${ok}/${tokens.length})`, 'ok'); }
        catch (e) { log(`Erro: ${e?.response?.data?.message || e.message}`, 'erro'); }
        await new Promise(r => setTimeout(r, 500));
      }
      log(`${ok} conta(s) agora online.`, 'ok');
      await pressEnter();
      if (voltou()) return;
    }

    if (acao === 'cfgstream') {
      const { su } = await inquirer.prompt([{ type: 'input', name: 'su', message: 'URL do streaming (Twitch/YouTube):', default: config.streamUrl }]);
      if (voltou()) return;
      const { st } = await inquirer.prompt([{ type: 'input', name: 'st', message: 'Titulo do streaming:', default: config.streamTitulo }]);
      if (voltou()) return;
      config.streamUrl    = su.trim() || config.streamUrl;
      config.streamTitulo = st.trim() || config.streamTitulo;
      cfg.save(config);
      log('Configuracoes de streaming salvas.', 'ok');
      await new Promise(r => setTimeout(r, 700));
    }
  }
}

// ─── 6. CANAIS DE VOZ ────────────────────────────────────────────────────────
async function menuVoz(config) {
  while (true) {
    banner();
    console.log(chalk.yellow('  [ 6. CANAIS DE VOZ ]\n'));
    console.log(chalk.gray('  Servidor: ') + chalk.white(config.serverId || 'nao config') + '\n');

    const { acao } = await inquirer.prompt([{
      type: 'list', name: 'acao', message: 'Opcao:',
      choices: [
        { name: chalk.gray('<- Voltar'), value: 'voltar' },
        { name: 'Entrar em canal de voz especifico',   value: 'especifico' },
        { name: 'Entrar em todos os canais de voz',    value: 'todos' },
        { name: 'Sair de todos os canais de voz',      value: 'sair' },
      ],
    }]);
    if (acao === 'voltar' || voltou()) return;

    if (!config.serverId) { log('Configure o servidor primeiro (opcao 3).', 'aviso'); await new Promise(r => setTimeout(r, 1500)); continue; }
    const tokens = config.tokens.slice(0, config.simultaneousUsers);
    if (!tokens.length) { log('Sem tokens configurados.', 'aviso'); await new Promise(r => setTimeout(r, 1200)); continue; }

    if (acao === 'especifico') {
      const { canalId } = await inquirer.prompt([{ type: 'input', name: 'canalId', message: 'ID do canal de voz:' }]);
      if (voltou() || !canalId.trim()) continue;
      let ok = 0;
      for (const token of tokens) {
        try {
          await abrir(token, { status: 'online' });
          const res = entrarVoz(token, config.serverId, canalId.trim(), true, false);
          if (res) { ok++; log(`Conta ${ok}/${tokens.length} entrou no canal ${canalId}`, 'ok'); }
          else { log('Gateway nao conectado para esse token.', 'aviso'); }
        } catch (e) { log(`Erro: ${e.message}`, 'erro'); }
        await new Promise(r => setTimeout(r, 500));
      }
      log(`${ok} conta(s) no canal de voz. Mantenha o painel aberto.`, 'ok');
      await pressEnter();
      if (voltou()) return;
    }

    if (acao === 'todos') {
      // Busca canais de voz (type 2)
      if (!config.tokens.length) { log('Sem tokens.', 'aviso'); await new Promise(r => setTimeout(r, 1200)); continue; }
      log('Buscando canais de voz...', 'info');
      let canaisVoz = [];
      try {
        const axios = require('axios');
        const res = await axios.get(`https://discord.com/api/v9/guilds/${config.serverId}/channels`, {
          headers: { Authorization: config.tokens[0] }, timeout: 10000,
        });
        canaisVoz = res.data.filter(c => c.type === 2); // GUILD_VOICE
      } catch (e) { log(`Erro ao buscar canais de voz: ${e.message}`, 'erro'); await new Promise(r => setTimeout(r, 1500)); continue; }

      if (!canaisVoz.length) { log('Nenhum canal de voz encontrado.', 'aviso'); await new Promise(r => setTimeout(r, 1200)); continue; }
      log(`${canaisVoz.length} canal(is) de voz encontrado(s). Distribuindo contas...`, 'info');
      console.log('');

      let idx = 0;
      for (const token of tokens) {
        const canal = canaisVoz[idx % canaisVoz.length];
        try {
          await abrir(token, { status: 'online' });
          await new Promise(r => setTimeout(r, 300));
          const res = entrarVoz(token, config.serverId, canal.id, true, false);
          log(`Conta ${idx+1} -> #${canal.name} (${canal.id})`, res ? 'ok' : 'aviso');
        } catch (e) { log(`Erro conta ${idx+1}: ${e.message}`, 'erro'); }
        idx++;
        await new Promise(r => setTimeout(r, 400));
      }
      log(`${tokens.length} conta(s) distribuidas nos canais de voz.`, 'ok');
      await pressEnter();
      if (voltou()) return;
    }

    if (acao === 'sair') {
      let ok = 0;
      for (const token of tokens) {
        const res = sairVoz(token, config.serverId);
        if (res) { ok++; log(`Conta ${ok} saiu da voz`, 'ok'); }
      }
      log(`${ok} conta(s) removidas da voz.`, 'ok');
      await new Promise(r => setTimeout(r, 800));
    }
  }
}

// ─── 7. CRIAR CONTAS ─────────────────────────────────────────────────────────
const METODOS_LABEL = { semcaptcha: 'Sem Captcha (tenta automatico)', nopecha: 'NopeCHA (GRATIS 1000/mes)', acessibilidade: 'Acessibilidade hCaptcha (GRATIS)', capsolver: 'CapSolver (pago)', manual: 'Manual (voce resolve no browser)' };

async function menuCriarContas(config) {
  while (true) {
    banner();
    console.log(chalk.yellow('  [ 7. CRIAR CONTAS DISCORD ]\n'));
    const metLbl = METODOS_LABEL[config.captchaMetodo] || config.captchaMetodo;
    const proxiesOk = (config.proxies || []).length;
    console.log(chalk.gray('  Captcha: ') + chalk.white(metLbl));
    console.log(chalk.gray('  Proxies: ') + (proxiesOk ? chalk.green(`${proxiesOk} configurado(s)`) : chalk.red('nenhum — IP proprio')));
    console.log(chalk.gray('  Dominio: ') + chalk.white(config.emailDominio));
    console.log(chalk.gray('  Gerar:   ') + chalk.white(config.qtdCriar) + ' conta(s)\n');

    const { acao } = await inquirer.prompt([{
      type: 'list', name: 'acao', message: 'Opcao:',
      choices: [
        { name: chalk.gray('<- Voltar'), value: 'voltar' },
        { name: 'Escolher metodo de captcha',               value: 'metodo' },
        { name: 'Configurar proxies (um por linha)',        value: 'proxies' },
        { name: 'Configurar dominio de email',              value: 'dom' },
        { name: 'Definir quantidade a criar (1-100)',       value: 'qtd' },
        { name: chalk.red('> CRIAR CONTAS AGORA'),          value: 'criar' },
      ],
    }]);
    if (acao === 'voltar' || voltou()) return;

    // ── Escolher metodo ──────────────────────────────────────────────────────
    if (acao === 'metodo') {
      const { met } = await inquirer.prompt([{
        type: 'list', name: 'met', message: 'Metodo de resolucao de captcha:',
        choices: [
          { name: chalk.gray('<- Voltar'), value: 'voltar' },
          {
            name: chalk.green.bold('Sem Captcha') + chalk.gray(' — tenta 3 perfis diferentes sem resolver nada'),
            value: 'semcaptcha',
          },
          {
            name: chalk.green('NopeCHA') + chalk.gray(' — GRATIS, 1000 resolucoes/mes, so precisa de API key'),
            value: 'nopecha',
          },
          {
            name: chalk.green('Acessibilidade hCaptcha') + chalk.gray(' — GRATIS, requer cadastro em hcaptcha.com'),
            value: 'acessibilidade',
          },
          {
            name: chalk.yellow('CapSolver') + chalk.gray(' — pago, tem creditos gratuitos no cadastro'),
            value: 'capsolver',
          },
          {
            name: chalk.cyan('Manual') + chalk.gray(' — voce resolve no browser e cola o token'),
            value: 'manual',
          },
        ],
      }]);
      if (met === 'voltar' || voltou()) continue;
      config.captchaMetodo = met;

      if (met === 'nopecha') {
        console.log('');
        console.log(chalk.white('  Como obter a API key gratuita do NopeCHA:'));
        console.log(chalk.gray('  1. Abra: ') + chalk.cyan('https://nopecha.com'));
        console.log(chalk.gray('  2. Crie conta com qualquer email'));
        console.log(chalk.gray('  3. Va em: Account -> API Key'));
        console.log(chalk.gray('  4. Copie e cole abaixo'));
        console.log(chalk.gray('  Limite gratis: 1000 resolucoes por mes'));
        console.log('');
        const { k } = await inquirer.prompt([{ type: 'input', name: 'k', message: 'NopeCHA API Key:', default: config.nopechaKey }]);
        if (voltou()) return;
        config.nopechaKey = k.trim();
      }

      if (met === 'acessibilidade') {
        console.log('');
        console.log(chalk.white('  Como obter o cookie de acessibilidade (GRATIS):'));
        console.log(chalk.gray('  1. Abra: ') + chalk.cyan('https://www.hcaptcha.com/accessibility'));
        console.log(chalk.gray('  2. Cadastre-se e faca login'));
        console.log(chalk.gray('  3. Abra DevTools (F12) -> Application -> Cookies'));
        console.log(chalk.gray('  4. Clique em: ') + chalk.cyan('https://dashboard.hcaptcha.com'));
        console.log(chalk.gray('  5. Copie o valor de "hc_accessibility"'));
        console.log('');
        const { cookie } = await inquirer.prompt([{ type: 'input', name: 'cookie', message: 'Cole o cookie hc_accessibility:', default: config.accessCookie }]);
        if (voltou()) return;
        config.accessCookie = cookie.trim();
      }

      if (met === 'capsolver') {
        console.log('');
        console.log(chalk.gray('  Crie conta em https://capsolver.com'));
        console.log(chalk.gray('  Novos usuarios recebem creditos gratis para testar.'));
        console.log('');
        const { k } = await inquirer.prompt([{ type: 'input', name: 'k', message: 'CapSolver API Key:', default: config.capsolverKey }]);
        if (voltou()) return;
        config.capsolverKey = k.trim();
      }

      cfg.save(config);
      log(`Metodo definido: ${METODOS_LABEL[met]}`, 'ok');
      await new Promise(r => setTimeout(r, 800));
    }

    // ── Proxies ──────────────────────────────────────────────────────────────
    if (acao === 'proxies') {
      console.log('');
      console.log(chalk.white('  Formatos aceitos (um por linha):'));
      console.log(chalk.gray('    host:porta'));
      console.log(chalk.gray('    usuario:senha@host:porta'));
      console.log(chalk.gray('    http://host:porta'));
      console.log(chalk.gray('  Proxies HTTP/HTTPS gratis: proxyscrape.com, free-proxy-list.net'));
      console.log(chalk.gray('  Cole os proxies (virgula ou espaco) e pressione Enter.\n'));
      const { raw } = await inquirer.prompt([{ type: 'input', name: 'raw', message: 'Proxies:', default: (config.proxies || []).join(', ') }]);
      if (voltou()) return;
      const lista = raw.split(/[\n,\s]+/).map(p => p.trim()).filter(Boolean);
      config.proxies = lista;
      cfg.save(config);
      log(`${lista.length} proxy(s) salvos.`, lista.length ? 'ok' : 'aviso');
      await new Promise(r => setTimeout(r, 800));
    }

    // ── Dominio ──────────────────────────────────────────────────────────────
    if (acao === 'dom') {
      const { dom } = await inquirer.prompt([{ type: 'input', name: 'dom', message: 'Dominio de email:', default: config.emailDominio }]);
      if (voltou()) return;
      config.emailDominio = dom.trim() || config.emailDominio;
      cfg.save(config);
      log(`Dominio: ${config.emailDominio}`, 'ok');
      await new Promise(r => setTimeout(r, 600));
    }

    // ── Quantidade ───────────────────────────────────────────────────────────
    if (acao === 'qtd') {
      const { n } = await inquirer.prompt([{ type: 'number', name: 'n', message: 'Quantas contas criar? (1-100):', validate: v => v >= 1 && v <= 100 ? true : '1-100' }]);
      if (voltou()) return;
      config.qtdCriar = n;
      cfg.save(config);
      log(`Vai criar ${n} conta(s).`, 'ok');
      await new Promise(r => setTimeout(r, 600));
    }

    // ── CRIAR ─────────────────────────────────────────────────────────────────
    if (acao === 'criar') {
      // Validacoes por metodo
      if (config.captchaMetodo === 'semcaptcha') { /* sem validacao, tenta direto */ }
      if (config.captchaMetodo === 'nopecha' && !config.nopechaKey) {
        log('Configure a NopeCHA API Key primeiro (opcao "Escolher metodo").', 'aviso');
        await new Promise(r => setTimeout(r, 1800)); continue;
      }
      if (config.captchaMetodo === 'acessibilidade' && !config.accessCookie) {
        log('Configure o cookie de acessibilidade primeiro (opcao "Escolher metodo").', 'aviso');
        await new Promise(r => setTimeout(r, 1800)); continue;
      }
      if (config.captchaMetodo === 'capsolver' && !config.capsolverKey) {
        log('Configure a CapSolver API Key primeiro (opcao "Escolher metodo").', 'aviso');
        await new Promise(r => setTimeout(r, 1800)); continue;
      }

      console.log('');
      log(`Metodo: ${METODOS_LABEL[config.captchaMetodo]}`, 'info');
      log(`Criando ${config.qtdCriar} conta(s) com emails @${config.emailDominio}...`, 'info');
      console.log(chalk.gray('  Ctrl+C para cancelar\n'));

      const criadas = [];
      const erros   = [];

      for (let i = 0; i < config.qtdCriar; i++) {
        const usuario = usernameAleatorio();
        const email   = emailAleatorio(config.emailDominio);
        const senha   = senhaAleatoria();
        log(`[${i+1}/${config.qtdCriar}] ${usuario} (${email})`, 'info');

        // Modo manual: pede o token captcha para cada conta
        let tokenManual = null;
        if (config.captchaMetodo === 'manual') {
          console.log('');
          console.log(chalk.yellow('  Resolva o captcha manualmente:'));
          console.log(chalk.gray('  1. Abra: https://discord.com/register'));
          console.log(chalk.gray('  2. Preencha com: ') + chalk.white(`usuario: ${usuario} | email: ${email}`));
          console.log(chalk.gray('  3. DevTools (F12) -> Network -> filtre "register" -> veja captcha_key'));
          console.log('');
          const { tk } = await inquirer.prompt([{ type: 'input', name: 'tk', message: 'Cole o captcha_key aqui:' }]);
          if (voltou()) return;
          tokenManual = tk.trim();
        }

        // Seleciona proxy em round-robin
        const proxies = config.proxies || [];
        const proxy   = proxies.length ? proxies[i % proxies.length] : null;

        try {
          const conta = await registrarConta({
            email, username: usuario, senha,
            metodo:       config.captchaMetodo,
            nopechaKey:   config.nopechaKey,
            capsolverKey: config.capsolverKey,
            accessCookie: config.accessCookie,
            tokenManual,
            proxy,
            onStatus: msg => log(msg, 'info'),
          });
          criadas.push(conta);
          log(`[${i+1}] Criada! Token: ${conta.token.slice(0,22)}...`, 'ok');
          config.tokens = [...new Set([...config.tokens, conta.token])].slice(0, 100);
          cfg.save(config);
        } catch (e) {
          const msg = e?.response?.data ? JSON.stringify(e.response.data) : e.message;
          log(`[${i+1}] Erro: ${msg}`, 'erro');
          erros.push({ email, erro: msg });
        }

        if (i < config.qtdCriar - 1) await new Promise(r => setTimeout(r, 3000));
      }

      console.log('');
      console.log(chalk.green(`  Criadas: ${criadas.length}`) + (erros.length ? chalk.red(`  Erros: ${erros.length}`) : ''));
      console.log('');

      if (criadas.length) {
        criadas.forEach((c, i) => {
          console.log(chalk.gray(`  [${i+1}] `) + chalk.white(c.username) + chalk.gray(` | ${c.email} | ${c.senha}`));
        });
        console.log('');
        log('Tokens salvos automaticamente (opcao 1).', 'ok');

        // Salva tambem em tokens_criados.txt
        try {
          const dirPath = require('path').dirname(process.argv[1] || __filename);
          const arq = salvarTokensTxt(criadas, dirPath);
          log(`Backup salvo em: tokens_criados.txt`, 'ok');
        } catch (e) { log(`Nao foi possivel salvar txt: ${e.message}`, 'aviso'); }

        if (config.fotoUrl || config.bio) {
          log('Aplicando foto/bio...', 'info');
          for (const c of criadas) {
            if (config.fotoUrl) {
              try { await atualizarFoto(c.token, config.fotoUrl); log(`Foto -> ${c.username}`, 'ok'); }
              catch (e) { log(`Erro foto: ${e.message}`, 'erro'); }
              await new Promise(r => setTimeout(r, 800));
            }
            if (config.bio) {
              try { await atualizarBio(c.token, config.bio); log(`Bio -> ${c.username}`, 'ok'); }
              catch (e) { log(`Erro bio: ${e.message}`, 'erro'); }
              await new Promise(r => setTimeout(r, 500));
            }
          }
        }
      }

      await pressEnter();
      if (voltou()) return;
    }
  }
}

// ─── 8. ENTRAR EM SERVIDOR ───────────────────────────────────────────────────
async function menuEntrarServidor(config) {
  while (true) {
    banner();
    console.log(chalk.yellow('  [ 8. ENTRAR EM SERVIDOR VIA CONVITE ]\n'));
    console.log(chalk.gray('  Faz todas as contas ativas entrarem num servidor via link de convite.'));
    console.log(chalk.gray('  Nao precisa de captcha — funciona com tokens ja existentes.\n'));
    console.log(chalk.gray('  Tokens ativos: ') + chalk.white(Math.min(config.tokens.length, config.simultaneousUsers)) + '\n');

    const { acao } = await inquirer.prompt([{
      type: 'list', name: 'acao', message: 'Opcao:',
      choices: [
        { name: chalk.gray('<- Voltar'), value: 'voltar' },
        { name: chalk.red('> ENTRAR NO SERVIDOR AGORA'), value: 'entrar' },
      ],
    }]);
    if (acao === 'voltar' || voltou()) return;

    if (acao === 'entrar') {
      const { link } = await inquirer.prompt([{
        type: 'input', name: 'link',
        message: 'Link ou codigo do convite (ex: discord.gg/abc123 ou so "abc123"):',
      }]);
      if (voltou() || !link.trim()) continue;

      const tokens = config.tokens.slice(0, config.simultaneousUsers);
      if (!tokens.length) { log('Nenhum token configurado (opcao 1).', 'aviso'); await new Promise(r => setTimeout(r, 1500)); continue; }

      log(`Entrando em ${tokens.length} conta(s)...`, 'info');
      let ok = 0, err = 0;

      for (let i = 0; i < tokens.length; i++) {
        try {
          const res = await entrarServidor(tokens[i], link.trim());
          const nomeServidor = res?.guild?.name || res?.channel?.name || 'servidor';
          ok++;
          log(`[${i+1}/${tokens.length}] Entrou em: ${nomeServidor}`, 'ok');
        } catch (e) {
          err++;
          const msg = e?.response?.data?.message || e.message;
          log(`[${i+1}/${tokens.length}] Erro: ${msg}`, 'erro');
        }
        if (i < tokens.length - 1) await new Promise(r => setTimeout(r, 800));
      }

      console.log('');
      console.log(chalk.green(`  Sucesso: ${ok}`) + '  ' + (err ? chalk.red(`Erros: ${err}`) : ''));
      console.log('');
      await pressEnter();
      if (voltou()) return;
    }
  }
}

// ─── INICIAR ENVIO ────────────────────────────────────────────────────────────
async function menuIniciar(config) {
  banner();
  console.log(chalk.yellow('  [ INICIAR ENVIO ]\n'));

  const erros = [];
  if (!config.tokens.length)                       erros.push('Sem tokens  (opcao 1)');
  if (!config.channels.length)                     erros.push('Sem canais  (opcao 3)');
  if (!config.message && !config.mediaUrls.length) erros.push('Sem mensagem ou midia  (opcao 4)');

  if (erros.length) {
    erros.forEach(e => log(e, 'aviso'));
    await pressEnter();
    return;
  }

  const tokens = config.tokens.slice(0, config.simultaneousUsers);

  console.log(`  ${chalk.cyan('Contas:  ')} ${tokens.length}  (paralelo)`);
  console.log(`  ${chalk.cyan('Canais:  ')} ${config.channels.length}`);
  console.log(`  ${chalk.cyan('Mensagem:')} ${config.message || chalk.gray('(midia)')}`);
  console.log(`  ${chalk.cyan('Midias:  ')} ${config.mediaUrls.length} URL(s)`);
  console.log(`  ${chalk.cyan('Modo:    ')} ${chalk.red('INFINITO')} — Ctrl+C para parar`);
  console.log('');

  const { confirmar } = await inquirer.prompt([{ type: 'confirm', name: 'confirmar', message: chalk.red('Iniciar?') }]);
  if (voltou() || !confirmar) return;

  console.log('');
  log(`Iniciando ${tokens.length} conta(s). Ctrl+C para encerrar.\n`, 'info');

  let total = 0;
  const loops = tokens.map((token, idx) =>
    loopConta({
      token, channels: config.channels, message: config.message, mediaUrls: config.mediaUrls,
      contaNum: idx + 1,
      onSend:  (c, _, ch) => { total++; log(`C${String(c).padStart(2)} -> ${ch} | total: ${chalk.white(total)}`, 'envio'); },
      onError: (c, m)     => log(`C${String(c).padStart(2)} erro: ${m}`, 'erro'),
    })
  );
  await Promise.all(loops);
}

// ─── STATUS ───────────────────────────────────────────────────────────────────
function exibirStatus(config) {
  const ln = (l, v) => {
    const s = `  ${l.padEnd(12)}${v}`;
    const r = s.replace(/\x1B\[[0-9;]*m/g, '');
    return chalk.gray('  |') + s + ' '.repeat(Math.max(0, 44 - r.length)) + chalk.gray('|');
  };
  const msg = config.message
    ? (config.message.length > 26 ? config.message.slice(0,26)+'...' : config.message)
    : chalk.gray('nao config');
  return [
    chalk.gray('  +==========================================+'),
    chalk.gray('  |') + chalk.cyan('  STATUS ATUAL                            ') + chalk.gray('|'),
    chalk.gray('  +==========================================+'),
    ln('Tokens:',   `${chalk.white(config.tokens.length)}/100  Ativas: ${chalk.white(config.simultaneousUsers)}`),
    ln('Servidor:', config.serverId || chalk.red('nao config')),
    ln('Canais:',   `${chalk.white(config.channels.length)} texto`),
    ln('Mensagem:', msg),
    ln('Midias:',   `${chalk.white(config.mediaUrls.length)} URL(s)`),
    ln('Captcha:', chalk.white(config.captchaMetodo || 'nao config')),
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
      message: chalk.white('Selecione:'),
      choices: [
        { name: `${chalk.cyan('1.')} Tokens — ate 100`,                     value: '1' },
        { name: `${chalk.cyan('2.')} Contas ativas`,                         value: '2' },
        { name: `${chalk.cyan('3.')} Servidor e Canais`,                     value: '3' },
        { name: `${chalk.cyan('4.')} Mensagem e Midia (URLs)`,               value: '4' },
        { name: `${chalk.cyan('5.')} Personalizar Contas (foto/bio/RPC)`,    value: '5' },
        { name: `${chalk.cyan('6.')} Canais de Voz`,                         value: '6' },
        { name: `${chalk.cyan('7.')} Criar Contas Discord`,                  value: '7' },
        { name: `${chalk.cyan('8.')} Entrar em Servidor (convite)`,          value: '8' },
        { name: `${chalk.red('>')}  ${chalk.red.bold('INICIAR ENVIO')}`,    value: '9' },
        new inquirer.Separator(),
        { name: chalk.gray('Sair'), value: '0' },
      ],
    }]);

    if (voltou()) continue;
    if (opcao === '0') { fecharTodos(); console.log(chalk.gray('\n  Painel 141 encerrado.\n')); process.exit(0); }
    if (opcao === '1') { await menuTokens(config);          config = cfg.load(); }
    if (opcao === '2') { await menuContas(config);          config = cfg.load(); }
    if (opcao === '3') { await menuServidor(config);        config = cfg.load(); }
    if (opcao === '4') { await menuMensagem(config);        config = cfg.load(); }
    if (opcao === '5') { await menuPersonalizar(config);    config = cfg.load(); }
    if (opcao === '6') { await menuVoz(config);             config = cfg.load(); }
    if (opcao === '7') { await menuCriarContas(config);     config = cfg.load(); }
    if (opcao === '8') { await menuEntrarServidor(config);  config = cfg.load(); }
    if (opcao === '9') { await menuIniciar(config);         config = cfg.load(); }
  }
}

module.exports = { mainMenu: menuPrincipal };
