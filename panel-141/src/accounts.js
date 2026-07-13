'use strict';
// Criacao de contas Discord
// Usa CapSolver para resolver hCaptcha + API de registro do Discord

const axios = require('axios');
const fs    = require('fs');
const path  = require('path');

const BASE    = 'https://discord.com/api/v9';
const CAPS    = 'https://api.capsolver.com';
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

// Resolve hCaptcha com CapSolver
async function resolverCaptcha(capsolverKey) {
  // Criar tarefa
  const createRes = await axios.post(`${CAPS}/createTask`, {
    clientKey: capsolverKey,
    task: {
      type:    'HCaptchaTaskProxyLess',
      websiteURL: SITE_URL,
      websiteKey: SITE_KEY,
    },
  }, { timeout: 15000 });

  const taskId = createRes.data?.taskId;
  if (!taskId) throw new Error(`CapSolver: ${JSON.stringify(createRes.data)}`);

  // Aguardar resultado (ate 120s)
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const res = await axios.post(`${CAPS}/getTaskResult`, {
      clientKey: capsolverKey,
      taskId,
    }, { timeout: 10000 });
    const { status, solution, errorId, errorDescription } = res.data;
    if (errorId) throw new Error(`CapSolver erro: ${errorDescription}`);
    if (status === 'ready') return solution.gRecaptchaResponse || solution.userAgent;
    // status === 'processing' -> continuar aguardando
  }
  throw new Error('CapSolver timeout — captcha nao resolvido em 120s');
}

// Registra uma conta no Discord
async function registrarConta({ email, username, senha, capsolverKey, onStatus }) {
  if (onStatus) onStatus(`Resolvendo captcha para ${email}...`);
  const captchaKey = await resolverCaptcha(capsolverKey);

  if (onStatus) onStatus(`Registrando ${username}...`);
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'X-Super-Properties': Buffer.from(JSON.stringify({
      os: 'Windows', browser: 'Chrome', device: '',
      browser_version: '120.0.0.0', os_version: '10',
    })).toString('base64'),
    Origin: 'https://discord.com',
    Referer: 'https://discord.com/register',
  };

  const res = await axios.post(`${BASE}/auth/register`, {
    username,
    email,
    password: senha,
    date_of_birth: '1999-01-15',
    consent: true,
    captcha_key: captchaKey,
    gift_code_sku_id: null,
    promotional_email_opt_in: false,
  }, { headers, timeout: 15000 });

  // Sucesso retorna { token: '...' }
  const token = res.data?.token;
  if (!token) throw new Error(JSON.stringify(res.data));
  return { email, username, senha, token };
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

module.exports = {
  usernameAleatorio, emailAleatorio, senhaAleatoria,
  registrarConta, atualizarFoto, atualizarBio, atualizarStatus,
};
