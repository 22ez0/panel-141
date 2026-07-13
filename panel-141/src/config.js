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
  mediaUrls: [],   // lista de URLs de midia (Discord CDN, imgur, etc.)
};

function load() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const saved = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      // compatibilidade com config antiga (mediaPath -> mediaUrls)
      if (saved.mediaPath && !saved.mediaUrls) {
        saved.mediaUrls = saved.mediaPath ? [saved.mediaPath] : [];
        delete saved.mediaPath;
      }
      return { ...DEFAULT, ...saved };
    }
  } catch (_) {}
  return { ...DEFAULT };
}

function save(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

module.exports = { load, save, CONFIG_PATH };
