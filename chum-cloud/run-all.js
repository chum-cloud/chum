#!/usr/bin/env node

// Run all 3 CHUM Cloud seed agents concurrently.
// Each agent runs in a child process with prefixed output.

const { spawn } = require('child_process');
const path = require('path');

const AGENTS = [
  { name: 'whale',    script: 'agents/whale.js',    color: '\x1b[36m' },  // cyan
  { name: 'volume',   script: 'agents/volume.js',   color: '\x1b[33m' },  // yellow
  { name: 'momentum', script: 'agents/momentum.js', color: '\x1b[35m' },  // magenta
];
const RESET = '\x1b[0m';

console.log('');
console.log('CHUM Cloud — Starting All Agents');
console.log('════════════════════════════════════════');
console.log('');

const children = [];

for (const agent of AGENTS) {
  const child = spawn('node', [path.join(__dirname, agent.script)], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });

  const prefix = `${agent.color}[${agent.name.padEnd(8)}]${RESET}`;

  child.stdout.on('data', (data) => {
    for (const line of data.toString().split('\n')) {
      if (line.length > 0) console.log(`${prefix} ${line}`);
    }
  });

  child.stderr.on('data', (data) => {
    for (const line of data.toString().split('\n')) {
      if (line.length > 0) console.error(`${prefix} ${line}`);
    }
  });

  child.on('exit', (code) => {
    console.log(`${prefix} exited with code ${code}`);
  });

  children.push(child);
}

// Forward SIGINT/SIGTERM to children
function cleanup() {
  console.log('\nShutting down agents...');
  for (const child of children) {
    child.kill('SIGTERM');
  }
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
