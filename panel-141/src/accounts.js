'use strict';
// Criacao de contas Discord
// Usa CapSolver para resolver hCaptcha + API de registro do Discord

const axios = require('axios');
const fs    = require('fs');
const path  = require('path');

const BASE    = 'https://discord.com/api/v9';
const CAPS    = 'https://api.capsolver.com';
const NOPECHA = 'https://api.nopecha.com';
const SITE_KEY   = '4c672d35-0701-42b2-88c3-78380b0db560'; // Discord hCaptcha
const SITE_URL   = 'https://discord.com';

// Adjetivos e substantivos para usernames aleatorios
const ADJ  = ['cool','dark','red','blue','fast','epic','lone','iron','neo','sky','void','zero','alpha','beta','rogue'];
const SUBS = ['wolf','fox','hawk','shadow','storm','ghost','blade','pulse','echo','drift','nova','comet','flash'];

function usernameAleatorio() {
  const a = ADJ[Math.floor(Math.random() * ADJ.length)];
  const s = SUBS[Math.floor(Math.random() * SUBS.length)];
  const n = Math.floor(Math.random() * 9000) + 1000;
  return `${a}${s}${n}`;
}

function emailAleatorio(dominio = 'ikiss.me') {
  const user = usernameAleatorio().toLowerCase();
  return `${user}@${dominio}`;
}

function senhaAleatoria() {
  const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
  let p = '';
  for (let i = 0; i < 16; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return p;
}

// ─── METODOS DE RESOLVER CAPTCHA ────────────────────────────────────────────

// Metodo 1: CapSolver (pago, tem free tier no cadastro)
async function resolverCapSolver(capsolverKey) {
  const createRes = await axios.post(`${CAPS}/createTask`, {
    clientKey: capsolverKey,
    task: { type: 'HCaptchaTaskProxyLess', websiteURL: SITE_URL, websiteKey: SITE_KEY },
  }, { timeout: 15000 });

  const taskId = createRes.data?.taskId;
  if (!taskId) throw new Error(`CapSolver: ${JSON.stringify(createRes.data)}`);

  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const res = await axios.post(`${CAPS}/getTaskResult`, { clientKey: capsolverKey, taskId }, { timeout: 10000 });
    const { status, solution, errorId, errorDescription } = res.data;
    if (errorId) throw new Error(`CapSolver erro: ${errorDescription}`);
    if (status === 'ready') return solution.gRecaptchaResponse;
  }
  throw new Error('CapSolver timeout — nao resolvido em 120s');
}

// Metodo 2: hCaptcha Accessibility (GRATIS)
// O usuario registra uma vez em https://www.hcaptcha.com/accessibility
// e pega o cookie "hc_accessibility" do browser.
// Esse cookie gera tokens de bypass sem precisar resolver nada.
async function resolverAccessibility(accessCookie) {
  // Etapa 1 — obter challenge_id usando o cookie de acessibilidade
  const resp1 = await axios.post(
    'https://hcaptcha.com/getcaptcha/v1',
    new URLSearchParams({
      host:    'discord.com',
      sitekey: SITE_KEY,
      sc:      '1',
      swa:     '1',
      spst:    '1',
    }).toString(),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: `hc_accessibility=${accessCookie}`,
        Referer: 'https://discord.com/',
        Origin:  'https://discord.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 15000,
    }
  );

  // Se o cookie for valido, o endpoint retorna generated_pass_UUID diretamente
  const passUUID = resp1.data?.generated_pass_UUID;
  if (passUUID) return passUUID;

  // Alguns versoes retornam c (challenge) — tenta checkcaptcha com accessibility
  const c  = resp1.data?.c?.req;
  const key = resp1.data?.key;
  if (!c || !key) throw new Error('Cookie de acessibilidade invalido ou expirado. Gere um novo em https://www.hcaptcha.com/accessibility');

  const resp2 = await axios.post(
    'https://hcaptcha.com/checkcaptcha/v1/' + key,
    { c, job_mode: 'hCaptchaAccessibility', answers: {}, motionData: '{}' },
    {
      headers: {
        'Content-Type': 'application/json',
        Cookie: `hc_accessibility=${accessCookie}`,
        Referer: 'https://discord.com/',
        Origin:  'https://discord.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 15000,
    }
  );

  const token = resp2.data?.generated_pass_UUID;
  if (!token) throw new Error('Accessibility nao retornou token. Cookie pode estar expirado.');
  return token;
}

// Metodo 3: NopeCHA (gratis — 1000 resolucoes/mes)
// Crie conta em https://nopecha.com e copie a API key
async function resolverNopecha(nopechaKey, onStatus) {
  if (onStatus) onStatus('NopeCHA: enviando tarefa...');
  // Cria tarefa
  const createRes = await axios.post(NOPECHA, {
    type: 'hcaptcha',
    key: nopechaKey,
    sitekey: SITE_KEY,
    url: SITE_URL,
  }, { timeout: 15000 });

  if (createRes.data?.error) throw new Error(`NopeCHA: ${createRes.data.error}`);
  const taskId = createRes.data?.data;
  if (!taskId) throw new Error(`NopeCHA: resposta inesperada: ${JSON.stringify(createRes.data)}`);

  if (onStatus) onStatus(`NopeCHA: aguardando resolucao (ID: ${taskId})...`);

  // Aguarda resultado (polling a cada 3s, max 2min)
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const res = await axios.get(NOPECHA, {
      params: { type: 'hcaptcha', key: nopechaKey, id: taskId },
      timeout: 10000,
    });
    if (res.data?.error) throw new Error(`NopeCHA erro: ${res.data.error}`);
    const token = res.data?.data?.[0];
    if (token) return token;
  }
  throw new Error('NopeCHA timeout — nao resolvido em 120s');
}

// Metodo 4: Manual — usuario resolve no browser e cola o token
async function resolverManual(onStatus) {
  if (onStatus) onStatus(
    'Abra no browser: https://discord.com/register\n' +
    '  Preencha o formulario, resolva o captcha manualmente.\n' +
    '  Depois, no DevTools (F12) -> Network -> filtre "register"\n' +
    '  -> Payload -> copie o valor de "captcha_key".\n' +
    '  Cole abaixo:'
  );
  // Nao da pra ler do terminal facilmente aqui; retorna placeholder
  // O menu trata o input
  return null; // menu vai pedir o token inline
}

// Dispatcher — escolhe o metodo certo
async function resolverCaptcha({ metodo, capsolverKey, accessCookie, nopechaKey, tokenManual, onStatus }) {
  if (metodo === 'nopecha')        return await resolverNopecha(nopechaKey, onStatus);
  if (metodo === 'capsolver')      return await resolverCapSolver(capsolverKey);
  if (metodo === 'acessibilidade') return await resolverAccessibility(accessCookie);
  if (metodo === 'manual')         return tokenManual;
  if (metodo === 'semcaptcha')     return null; // tenta sem captcha
  throw new Error('Metodo de captcha nao definido');
}

// Diferentes perfis de headers para tentar passar sem captcha
const PERFIS = [
  // Perfil 1: iOS Discord app
  {
    'User-Agent': 'Discord/220.0 CFNetwork/1474 Darwin/23.0.0',
    'X-Super-Properties': Buffer.from(JSON.stringify({
      os: 'iOS', browser: 'Discord iOS', device: 'iPhone14,3',
      browser_version: '220.0', os_version: '17.0',
      referrer: '', referring_domain: '',
      referrer_current: '', referring_domain_current: '',
      release_channel: 'stable', system_locale: 'pt-BR',
    })).toString('base64'),
    'X-Discord-Locale': 'pt-BR',
    'X-Discord-Timezone': 'America/Sao_Paulo',
  },
  // Perfil 2: Android Discord app
  {
    'User-Agent': 'com.discord/204.5 Android (29; android; generic_x86)',
    'X-Super-Properties': Buffer.from(JSON.stringify({
      os: 'Android', browser: 'Discord Android', device: 'android',
      browser_version: '204.5', os_version: '10',
      referrer: '', referring_domain: '',
      release_channel: 'stable', system_locale: 'pt-BR',
    })).toString('base64'),
    'X-Discord-Locale': 'pt-BR',
    'X-Discord-Timezone': 'America/Sao_Paulo',
  },
  // Perfil 3: Desktop Chrome sem captcha
  {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'X-Super-Properties': Buffer.from(JSON.stringify({
      os: 'Windows', browser: 'Chrome', device: '',
      browser_version: '120.0.0.0', os_version: '10',
      referrer: '', referring_domain: '',
      release_channel: 'stable', system_locale: 'pt-BR',
    })).toString('base64'),
    'X-Discord-Locale': 'pt-BR',
    'X-Discord-Timezone': 'America/Sao_Paulo',
  },
];

async function tentarRegistrar(username, email, senha, captchaKey, perfilIdx = 0) {
  const perfil = PERFIS[perfilIdx % PERFIS.length];
  const headers = {
    'Content-Type': 'application/json',
    Origin:  'https://discord.com',
    Referer: 'https://discord.com/register',
    ...perfil,
  };
  const body = {
    username, email,
    password: senha,
    date_of_birth: '1999-01-15',
    consent: true,
    gift_code_sku_id: null,
    promotional_email_opt_in: false,
  };
  if (captchaKey) body.captcha_key = captchaKey;

  return axios.post(`${BASE}/auth/register`, body, { headers, timeout: 15000 });
}

// Registra uma conta no Discord
async function registrarConta({ email, username, senha, metodo, capsolverKey, accessCookie, nopechaKey, tokenManual, onStatus }) {
  // Modo sem captcha: tenta todos os perfis sem resolver nada
  if (metodo === 'semcaptcha') {
    for (let p = 0; p < PERFIS.length; p++) {
      if (onStatus) onStatus(`Tentativa sem captcha (perfil ${p + 1}/${PERFIS.length})...`);
      try {
        const res = await tentarRegistrar(username, email, senha, null, p);
        const token = res.data?.token;
        if (token) return { email, username, senha, token };
      } catch (e) {
        const data = e?.response?.data;
        // Se Discord pede captcha, tenta proximo perfil
        if (data?.captcha_key) { continue; }
        // Outro erro (rate limit, etc.)
        throw new Error(data ? JSON.stringify(data) : e.message);
      }
    }
    throw new Error('Discord exigiu captcha em todos os perfis. Troque para NopeCHA ou CapSolver.');
  }

  // Modos com captcha
  if (onStatus) onStatus(`Resolvendo captcha para ${email}...`);
  const captchaKey = await resolverCaptcha({ metodo, capsolverKey, accessCookie, nopechaKey, tokenManual, onStatus });

  if (onStatus) onStatus(`Registrando ${username}...`);
  try {
    const res = await tentarRegistrar(username, email, senha, captchaKey, 0);
    const token = res.data?.token;
    if (!token) throw new Error(JSON.stringify(res.data));
    return { email, username, senha, token };
  } catch (e) {
    const data = e?.response?.data;
    throw new Error(data ? JSON.stringify(data) : e.message);
  }
}

// Atualiza foto de perfil (base64 ou URL)
async function atualizarFoto(token, fotoUrlOuPath) {
  let b64;
  if (fotoUrlOuPath.startsWith('http')) {
    const res = await axios.get(fotoUrlOuPath, { responseType: 'arraybuffer', timeout: 15000 });
    const mime = res.headers['content-type'] || 'image/jpeg';
    b64 = `data:${mime};base64,${Buffer.from(res.data).toString('base64')}`;
  } else {
    const buf  = fs.readFileSync(fotoUrlOuPath);
    const ext  = path.extname(fotoUrlOuPath).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
    b64 = `data:${mime};base64,${buf.toString('base64')}`;
  }

  const headers = {
    Authorization: token,
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  };
  const res = await axios.patch(`${BASE}/users/@me`, { avatar: b64 }, { headers, timeout: 20000 });
  return res.data;
}

// Atualiza bio
async function atualizarBio(token, bio) {
  const headers = {
    Authorization: token, 'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  };
  const res = await axios.patch(`${BASE}/users/@me`, { bio }, { headers, timeout: 10000 });
  return res.data;
}

// Define status (online / idle / dnd / invisible)
async function atualizarStatus(token, status = 'invisible') {
  const headers = {
    Authorization: token, 'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  };
  // Endpoint de settings de usuario
  const res = await axios.patch(`${BASE}/users/@me/settings`, { status }, { headers, timeout: 10000 });
  return res.data;
}

// Salva lista de contas criadas em tokens_criados.txt na mesma pasta do painel
function salvarTokensTxt(contas, dirPath) {
  const linhas = contas.map(c =>
    `${c.token} | ${c.username} | ${c.email} | ${c.senha}`
  ).join('\n');
  const arquivo = require('path').join(dirPath, 'tokens_criados.txt');
  const existente = (() => {
    try { return require('fs').readFileSync(arquivo, 'utf8'); } catch { return ''; }
  })();
  const conteudo = existente ? existente + '\n' + linhas : linhas;
  require('fs').writeFileSync(arquivo, conteudo + '\n');
  return arquivo;
}

module.exports = {
  usernameAleatorio, emailAleatorio, senhaAleatoria,
  registrarConta, atualizarFoto, atualizarBio, atualizarStatus, salvarTokensTxt,
};
