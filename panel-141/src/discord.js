'use strict';
const axios    = require('axios');
const fs       = require('fs');
const FormData = require('form-data');
const path     = require('path');

const BASE = 'https://discord.com/api/v9';

// Suporta token de usuario (self-bot) e token de bot
function buildHeaders(token) {
  const isBot = token.startsWith('Bot ') || token.startsWith('Bearer ');
  return {
    Authorization: isBot ? token : token,  // user token usa direto, sem prefixo
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'X-Super-Properties': Buffer.from(JSON.stringify({
      os: 'Windows',
      browser: 'Chrome',
      device: '',
      browser_version: '120.0.0.0',
      os_version: '10',
    })).toString('base64'),
  };
}

function client(token) {
  return axios.create({
    baseURL: BASE,
    headers: buildHeaders(token),
    timeout: 15000,
  });
}

// Valida token (user ou bot)
async function validateToken(token) {
  try {
    const res = await client(token).get('/users/@me');
    return { ok: true, user: res.data };
  } catch (e) {
    return { ok: false, error: e?.response?.data?.message || e.message };
  }
}

// Busca canais de texto do servidor
async function getChannels(token, guildId) {
  try {
    const res = await client(token).get(`/guilds/${guildId}/channels`);
    return res.data.filter(c => c.type === 0);
  } catch (e) {
    throw new Error(e?.response?.data?.message || e.message);
  }
}

// Envia mensagem de texto
async function sendMessage(token, channelId, content) {
  const res = await client(token).post(`/channels/${channelId}/messages`, { content });
  return res.data;
}

// Envia arquivo (foto ou video)
async function sendFile(token, channelId, filePath, caption) {
  const fd = new FormData();
  fd.append('file', fs.createReadStream(filePath), path.basename(filePath));
  if (caption) fd.append('content', caption);

  const headers = { ...buildHeaders(token), ...fd.getHeaders() };
  delete headers['Content-Type'];

  const res = await axios.post(`${BASE}/channels/${channelId}/messages`, fd, {
    headers,
    timeout: 30000,
  });
  return res.data;
}

// Loop infinito de envio — roda ate o usuario dar Ctrl+C
async function runUserLoop({ token, channels, message, mediaPath, userId, delayMs, onSend, onError }) {
  const { randomBetween } = require('./utils');
  let count = 0;

  while (true) {
    const channelId = channels[count % channels.length];
    try {
      if (mediaPath) {
        await sendFile(token, channelId, mediaPath, message);
      } else {
        await sendMessage(token, channelId, message);
      }
      count++;
      if (onSend) onSend(userId, count, channelId);
    } catch (e) {
      const msg = e?.response?.data?.message || e.message;
      if (onError) onError(userId, msg);
      // Rate limit: espera o tempo indicado pelo Discord
      if (e?.response?.status === 429) {
        const retryAfter = (e.response?.data?.retry_after || 1) * 1000;
        await new Promise(r => setTimeout(r, retryAfter));
        continue;
      }
    }

    const wait = delayMs || randomBetween(800, 2000);
    await new Promise(r => setTimeout(r, wait));
  }
}

module.exports = { validateToken, getChannels, sendMessage, sendFile, runUserLoop };
