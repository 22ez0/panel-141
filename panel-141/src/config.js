'use strict';
const fs   = require('fs');
const path = require('path');

const SCRIPT_DIR  = path.dirname(process.argv[1] || __filename);
const CONFIG_PATH = path.join(SCRIPT_DIR, 'config.json');

const DEFAULT = {
  tokens: [],
  serverId: '',
  channels: [],
  simultaneousUsers: 1,
  message: '',
  mediaUrls: [],
  // Personalizacao de contas
  fotoUrl: '',          // URL ou caminho de arquivo para foto de perfil
  bio: '',
  streamUrl: 'https://www.twitch.tv/directory',
  streamTitulo: 'Ao vivo',
  // Criacao de contas
  captchaMetodo: 'acessibilidade', // 'acessibilidade' | 'capsolver' | 'manual'
  accessCookie: '',   // cookie hc_accessibility (gratis)
  capsolverKey: '',   // CapSolver API key (pago)
  emailDominio: 'ikiss.me',
  qtdCriar: 1,
};

function load() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const saved = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      // compatibilidade: mediaPath antigo
      if (saved.mediaPath && !saved.mediaUrls) {
        saved.mediaUrls = [saved.mediaPath];
        delete saved.mediaPath;
      }
      return { ...DEFAULT, ...saved };
    }
  } catch (_) {}
  return { ...DEFAULT };
}

function save(c) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(c, null, 2));
}

module.exports = { load, save, CONFIG_PATH };
