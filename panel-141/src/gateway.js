'use strict';
// Gateway WebSocket — mantem conexoes abertas por token
// Usado para: streaming RPC, presenca, entrar em canal de voz

const WebSocket = require('ws');

const GATEWAY_URL = 'wss://gateway.discord.gg/?v=10&encoding=json';

// Mapa token -> { ws, hbInterval, seq, sessionId }
const conns = new Map();

function buildPresenca(opts = {}) {
  const { status = 'online', streaming = false, streamUrl, streamTitle } = opts;
  const activities = [];
  if (streaming) {
    // URL precisa ser twitch.tv/<canal> ou youtube.com para badge roxo aparecer
    const url = (streamUrl && streamUrl.includes('twitch.tv/') && !streamUrl.endsWith('/directory'))
      ? streamUrl
      : 'https://www.twitch.tv/discord'; // fallback valido
    activities.push({
      name:    'Twitch',
      type:    1, // STREAMING — badge roxo
      url,
      details: streamTitle || 'Ao vivo',
      state:   'Streaming',
    });
  }
  return { status, activities, afk: false, since: 0 };
}

// Envia op 3 (UPDATE_PRESENCE) para uma conexao aberta
function _enviarPresenca(conn, opts) {
  if (conn.ws.readyState !== WebSocket.OPEN) return;
  conn.ws.send(JSON.stringify({ op: 3, d: buildPresenca(opts) }));
}

// Abre (ou reutiliza) conexao de gateway para o token
function abrir(token, opts = {}) {
  return new Promise((resolve, reject) => {
    if (conns.has(token)) { resolve(conns.get(token)); return; }

    const ws   = new WebSocket(GATEWAY_URL);
    const conn = { ws, hbInterval: null, seq: null, opts };
    conns.set(token, conn);

    let pronto = false;

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }
      const { op, d, s, t } = msg;
      if (s) conn.seq = s;

      // HELLO — inicia heartbeat e envia IDENTIFY
      if (op === 10) {
        conn.hbInterval = setInterval(() => {
          ws.readyState === WebSocket.OPEN &&
            ws.send(JSON.stringify({ op: 1, d: conn.seq }));
        }, d.heartbeat_interval);

        ws.send(JSON.stringify({
          op: 2, // IDENTIFY
          d: {
            token,
            properties: { os: 'Windows', browser: 'Discord Client', device: 'Discord Client' },
            presence: buildPresenca(opts),
            intents: 0,
          },
        }));
      }

      // READY — conexao autenticada; envia op 3 explicitamente para garantir presenca
      if (op === 0 && t === 'READY') {
        conn.sessionId = d.session_id;
        // Envia op 3 apos READY para garantir que streaming/status aparece
        setTimeout(() => _enviarPresenca(conn, opts), 500);
        if (!pronto) { pronto = true; resolve(conn); }
      }

      // RECONNECT / INVALID_SESSION
      if (op === 7 || (op === 9 && !d)) {
        ws.close();
        conns.delete(token);
        setTimeout(() => abrir(token, opts).then(resolve).catch(reject), 2000);
      }
    });

    ws.on('error', (e) => { conns.delete(token); if (!pronto) reject(e); });
    ws.on('close', () => {
      if (conn.hbInterval) clearInterval(conn.hbInterval);
      conns.delete(token);
    });

    // Timeout de seguranca — nao travar se READY demorar
    setTimeout(() => {
      if (!pronto) { pronto = true; resolve(conn); }
    }, 10000);
  });
}

// Atualiza presenca em conexao ja aberta
function atualizarPresenca(token, opts) {
  const conn = conns.get(token);
  if (!conn || conn.ws.readyState !== WebSocket.OPEN) return false;
  conn.opts = opts; // atualiza opts do conn
  _enviarPresenca(conn, opts);
  return true;
}

// Entra em canal de voz (op 4)
function entrarVoz(token, guildId, channelId, mudo = true, surdo = false) {
  const conn = conns.get(token);
  if (!conn || conn.ws.readyState !== WebSocket.OPEN) return false;
  conn.ws.send(JSON.stringify({
    op: 4,
    d: {
      guild_id:   guildId,
      channel_id: channelId,
      self_mute:  mudo,
      self_deaf:  surdo,
    },
  }));
  return true;
}

// Sair do canal de voz
function sairVoz(token, guildId) {
  const conn = conns.get(token);
  if (!conn || conn.ws.readyState !== WebSocket.OPEN) return false;
  conn.ws.send(JSON.stringify({
    op: 4, d: { guild_id: guildId, channel_id: null, self_mute: false, self_deaf: false },
  }));
  return true;
}

// Fecha conexao
function fechar(token) {
  const conn = conns.get(token);
  if (conn) {
    if (conn.hbInterval) clearInterval(conn.hbInterval);
    conn.ws.close();
    conns.delete(token);
  }
}

function fecharTodos() {
  for (const token of conns.keys()) fechar(token);
}

module.exports = { abrir, atualizarPresenca, entrarVoz, sairVoz, fechar, fecharTodos };
