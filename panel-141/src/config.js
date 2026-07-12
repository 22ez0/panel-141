'use strict';
const fs   = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

const DEFAULT = {
  tokens: [],        // Discord user/bot tokens
  serverId: '',      // Target server (guild) ID
  channels: [],      // Target channel IDs
  messageRatio: 10,  // Send 1 message every N (default: 10)
  simultaneousUsers: 1,
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
