'use strict';
const axios    = require('axios');
const fs       = require('fs');
const FormData = require('form-data');
const path     = require('path');

const BASE = 'https://discord.com/api/v9';

function buildHeaders(token) {
  return {
    Authorization: token,
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'X-Super-Properties': Buffer.from(JSON.stringify({
      os: 'Windows', browser: 'Chrome', device: '',
      browser_version: '120.0.0.0', os_version: '10',
    })).toString('base64'),
  };
}

function client(token) {
  return axios.create({ baseURL: BASE, headers: buildHeaders(token), timeout: 10000 });
}

async function validateToken(token) {
  try {
    const res = await client(token).get('/users/@me');
    return { ok: true, user: res.data };
  } catch (e) {
    return { ok: false, error: e?.response?.data?.message || e.message };
  }
}

async function getChannels(token, guildId) {
  try {
    const res = await client(token).get(`/guilds/${guildId}/channels`);
    return res.data.filter(c => c.type === 0);
  } catch (e) {
    throw new Error(e?.response?.data?.message || e.message);
  }
}

// Envia mensagem de texto puro
async function sendMessage(token, channelId, content) {
  const res = await client(token).post(`/channels/${channelId}/messages`, { content });
  return res.data;
}

// Envia arquivo local como attachment
async function sendFile(token, channelId, filePath, caption) {
  const fd = new FormData();
  fd.append('file', fs.createReadStream(filePath), path.basename(filePath));
  if (caption) fd.append('content', caption);
  const headers = { ...buildHeaders(token), ...fd.getHeaders() };
  delete headers['Content-Type'];
  const res = await axios.post(`${BASE}/channels/${channelId}/messages`, fd, {
    headers, timeout: 30000,
  });
  return res.data;
}

// Envia midia: URL (discord CDN, imgur, etc.) ou arquivo local
// mediaUrls: array de strings — URL ou caminho de arquivo
// mediaIndex: qual usar nesta rodada (round-robin)
async function sendMidia(token, channelId, mediaUrls, message, mediaIndex) {
  const media = mediaUrls[mediaIndex % mediaUrls.length];
  const isUrl = media.startsWith('http://') || media.startsWith('https://');

  if (isUrl) {
    // URL: inclui no conteudo da mensagem — Discord faz o embed automaticamente
    const conteudo = message ? `${message}\n${media}` : media;
    return await sendMessage(token, channelId, conteudo);
  } else {
    // Caminho local: faz upload do arquivo
    return await sendFile(token, channelId, media, message);
  }
}

// Loop continuo de envio para UMA conta — sem delay, so respeita rate limit
async function loopConta({ token, channels, message, mediaUrls, contaNum, onSend, onError }) {
  let count = 0;
  let mediaIdx = 0;

  while (true) {
    const channelId = channels[count % channels.length];
    try {
      if (mediaUrls && mediaUrls.length) {
        await sendMidia(token, channelId, mediaUrls, message, mediaIdx);
        mediaIdx++;
      } else {
        await sendMessage(token, channelId, message);
      }
      count++;
      if (onSend) onSend(contaNum, count, channelId);
    } catch (e) {
      const msg = e?.response?.data?.message || e.message;
      if (onError) onError(contaNum, msg);
      if (e?.response?.status === 429) {
        const espera = Math.ceil((e.response?.data?.retry_after || 1) * 1000);
        if (onError) onError(contaNum, `Rate limit — aguardando ${(espera/1000).toFixed(1)}s`);
        await new Promise(r => setTimeout(r, espera));
      }
    }
  }
}

module.exports = { validateToken, getChannels, sendMessage, sendFile, sendMidia, loopConta };
