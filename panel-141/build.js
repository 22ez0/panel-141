const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['src/index.js'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: 'dist/panel.js',
  banner: { js: '#!/usr/bin/env node' },
  minify: false,
}).then(() => {
  console.log('Build OK → dist/panel.js');
}).catch(() => process.exit(1));
