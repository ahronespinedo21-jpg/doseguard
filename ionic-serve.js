#!/usr/bin/env node

/**
 * Workaround script for Ionic CLI compatibility with Angular 18+
 * Runs ng serve with appropriate Angular CLI syntax
 */

const { spawn } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);
const port = args.includes('--port') ? args[args.indexOf('--port') + 1] : '8100';
const host = args.includes('--host') ? args[args.indexOf('--host') + 1] : 'localhost';

// Filter out --host and --port as ng serve uses different syntax
const ngArgs = args
  .filter((arg, idx, arr) => {
    if (arg === '--host' || arg === '--port') return false;
    if (idx > 0 && (arr[idx - 1] === '--host' || arr[idx - 1] === '--port')) return false;
    return true;
  })
  .concat([`--host=${host}`, `--port=${port}`]);

const ng = spawn('ng', ['serve', ...ngArgs], {
  stdio: 'inherit',
  shell: true
});

process.on('SIGTERM', () => ng.kill());
process.on('SIGINT', () => ng.kill());

ng.on('exit', (code) => {
  process.exit(code);
});
