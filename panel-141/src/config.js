'use strict';
const fs   = require('fs');
const path = require('path');

// Salva config.json na mesma pasta do script (funciona bundled ou nao)
const SCRIPT_DIR  = path.dirname(process.argv[1] || __filename);
const CONFIG_PATH = path.join(SCRIPT_DIR, 'config.json');

const DEFAULT = {
  tokens: [],
  serverId: '',
  channels: [],
  simultaneousUsers: 1,
  message: '',
  mediaPath: '',
};

function load() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return { ...DEFAULT, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) };
    }
  } catch (_) {}
  return { ...DEFAULT };
}

function save(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

module.exports = { load, save, CONFIG_PATH };
