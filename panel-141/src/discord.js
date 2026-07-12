'use strict';
const axios    = require('axios');
const fs       = require('fs');
const FormData = require('form-data');
const path     = require('path');
const { log }  = require('./utils');

const BASE = 'https://discord.com/api/v10';

function client(token) {
  return axios.create({
    baseURL: BASE,
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
      'User-Agent': 'DiscordBot (https://github.com, 10)',
    },
    timeout: 15000,
  });
}

// Validate token and return username
async function validateToken(token) {
  try {
    const res = await client(token).get('/users/@me');
    return { ok: true, user: res.data };
  } catch (e) {
    return { ok: false, error: e?.response?.data?.message || e.message };
  }
}

// Fetch guild channels
async function getChannels(token, guildId) {
  try {
    const res = await client(token).get(`/guilds/${guildId}/channels`);
    return res.data.filter(c => c.type === 0); // text channels only
  } catch (e) {
    throw new Error(e?.response?.data?.message || e.message);
  }
}

// Send a plain text message
async function sendMessage(token, channelId, content) {
  const res = await client(token).post(`/channels/${channelId}/messages`, { content });
  return res.data;
}

// Send a file (photo or video) with optional caption
async function sendFile(token, channelId, filePath, caption = '') {
  const fd = new FormData();
  fd.append('file', fs.createReadStream(filePath), path.basename(filePath));
  if (caption) fd.append('content', caption);

  const res = await axios.post(`${BASE}/channels/${channelId}/messages`, fd, {
    headers: {
      Authorization: token,
      ...fd.getHeaders(),
    },
    timeout: 30000,
  });
  return res.data;
}

// Run a single "user session": send messages across channels with ratio
async function runUser({ token, channels, messages, mediaPath, ratio, userId, delayMs }) {
  const { sleep, randomBetween } = require('./utils');
  let sentCount = 0;

  for (let i = 0; i < messages.length; i++) {
    // pick a random channel from the list
    const channelId = channels[randomBetween(0, channels.length - 1)];
    const msg       = messages[i];

    try {
      if (mediaPath && (i + 1) % ratio === 0) {
        await sendFile(token, channelId, mediaPath, msg);
        log(`[User ${userId}] Mídia enviada → canal ${channelId}`, 'send');
      } else {
        await sendMessage(token, channelId, msg);
        log(`[User ${userId}] Mensagem ${i + 1}/${messages.length} → canal ${channelId}`, 'send');
      }
      sentCount++;
    } catch (e) {
      log(`[User ${userId}] Falha: ${e.message}`, 'error');
    }

    if (i < messages.length - 1) await sleep(delayMs || randomBetween(800, 2000));
  }

  return sentCount;
}

module.exports = { validateToken, getChannels, sendMessage, sendFile, runUser };
