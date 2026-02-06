#!/usr/bin/env node

// Run all 3 CHUM Cloud seed agents concurrently.
// Each agent runs in a child process with prefixed output.
// Designed for Railway deployment — auto-restarts crashed agents.

const { spawn } = require('child_process');
const path = require('path');

const AGENTS = [
  { name: 'whale',    script: 'agents/whale.js',    color: '\x1b[36m' },  // cyan
  { name: 'volume',   script: 'agents/volume.js',   color: '\x1b[33m' },  // yellow
  { name: 'momentum', script: 'agents/momentum.js', color: '\x1b[35m' },  // magenta
];
const RESET = '\x1b[0m';
const RESTART_DELAY = 5000; // 5 seconds before restart

console.log('');
console.log('════════════════════════════════════════');
console.log('  CHUM Cloud Seed Agents — Starting');
console.log('════════════════════════════════════════');
console.log(`  Time: ${new Date().toISOString()}`);
console.log(`  Node: ${process.version}`);
console.log('');

const children = new Map();

function startAgent(agent) {
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

  child.on('exit', (code, signal) => {
    console.log(`${prefix} exited (code=${code}, signal=${signal})`);
    children.delete(agent.name);

    // Auto-restart unless we're shutting down
    if (!shuttingDown) {
      console.log(`${prefix} restarting in ${RESTART_DELAY / 1000}s...`);
      setTimeout(() => {
        if (!shuttingDown) {
          console.log(`${prefix} restarting now`);
          startAgent(agent);
        }
      }, RESTART_DELAY);
    }
  });

  child.on('error', (err) => {
    console.error(`${prefix} spawn error: ${err.message}`);
  });

  children.set(agent.name, child);
  console.log(`${prefix} started (pid=${child.pid})`);
}

// Start all agents
for (const agent of AGENTS) {
  startAgent(agent);
}

// Graceful shutdown
let shuttingDown = false;

function cleanup(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`\n[main] Received ${signal}, shutting down agents...`);

  for (const [name, child] of children) {
    console.log(`[main] Stopping ${name} (pid=${child.pid})`);
    child.kill('SIGTERM');
  }

  // Give agents 3 seconds to exit gracefully
  setTimeout(() => {
    console.log('[main] Forcing exit');
    process.exit(0);
  }, 3000);
}

process.on('SIGINT', () => cleanup('SIGINT'));
process.on('SIGTERM', () => cleanup('SIGTERM'));

// Keep process alive
setInterval(() => {
  const running = Array.from(children.keys()).join(', ') || 'none';
  console.log(`[main] Health check — running: ${running}`);
}, 60_000);
