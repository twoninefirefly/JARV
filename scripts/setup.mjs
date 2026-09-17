#!/usr/bin/env node
// JARVIS preflight — a friendly, advisory check you run with `npm run setup`.
//
// It changes nothing and installs nothing. It looks at your machine, tells you
// what is ready and what is missing, and prints the two commands that start
// JARVIS. Every check degrades to a single friendly line if something is not
// there, and the script always exits 0 — it is advice, not a gate.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const tick = '  ok  ';
const warn = ' note ';
const info = '  ·   ';

function line(tag, msg) {
  console.log(`[${tag}] ${msg}`);
}

console.log('');
console.log('JARVIS Vorabprüfung — dein Rechner wird angesehen, nichts verändert');
console.log('------------------------------------------------------------');

// --- Node version --------------------------------------------------------
try {
  const major = Number(process.versions.node.split('.')[0]);
  if (Number.isFinite(major) && major >= 20) {
    line(tick, `Node.js ${process.versions.node} (20 oder neuer nötig).`);
  } else {
    line(warn, `Node.js ${process.versions.node} ist älter als 20. Bitte aktualisieren — die Bridge braucht 20 oder neuer.`);
  }
} catch {
  line(warn, 'Node.js-Version nicht lesbar. JARVIS braucht 20 oder neuer.');
}

// --- Claude CLI on PATH ---------------------------------------------------
let claudeFound = false;
try {
  const res = spawnSync('claude', ['--version'], { encoding: 'utf8', timeout: 10000 });
  if (res.status === 0 && res.stdout) {
    claudeFound = true;
    line(tick, `Claude CLI gefunden: ${res.stdout.trim()}`);
  }
} catch {
  // ignore — handled below
}
if (!claudeFound) {
  line(warn, 'Claude CLI nicht im PATH gefunden.');
  line(info, 'Empfohlen: curl -fsSL https://claude.ai/install.sh | bash');
  line(info, '  (oder über npm: npm install -g @anthropic-ai/claude-code)');
  line(info, 'Dann einmal `claude` starten und einloggen. Die Bridge nutzt diesen Login — kein API-Schlüssel nötig.');
}

// --- ~/.claude.json and MCP servers --------------------------------------
const claudeJsonPath = join(homedir(), '.claude.json');
let mcpCount = 0;
try {
  const raw = readFileSync(claudeJsonPath, 'utf8');
  let parsed = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }
  const servers = parsed && typeof parsed.mcpServers === 'object' && parsed.mcpServers ? parsed.mcpServers : {};
  mcpCount = Object.keys(servers).length;
  if (mcpCount > 0) {
    line(tick, `~/.claude.json gefunden, ${mcpCount} MCP-Server eingerichtet.`);
  } else {
    line(info, '~/.claude.json gefunden, aber noch keine MCP-Server. JARVIS antwortet trotzdem und steuert seine eigene Oberfläche.');
  }
} catch {
  line(info, '~/.claude.json noch nicht da. Sie entsteht, sobald du `claude` startest und dich einloggst. JARVIS läuft auch ohne MCP-Server.');
}

// --- ElevenLabs key (env or the elevenlabs MCP entry) --------------------
function findElevenLabsKey() {
  if (process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_API_KEY.trim()) {
    return 'environment (ELEVENLABS_API_KEY)';
  }
  try {
    const raw = readFileSync(claudeJsonPath, 'utf8');
    const parsed = JSON.parse(raw);
    const servers = parsed && parsed.mcpServers ? parsed.mcpServers : {};
    const el = servers.elevenlabs;
    const env = el && el.env ? el.env : {};
    if (env.ELEVENLABS_API_KEY && String(env.ELEVENLABS_API_KEY).trim()) {
      return 'the elevenlabs MCP server in ~/.claude.json';
    }
  } catch {
    // ignore — no key discoverable
  }
  return null;
}

const elSource = findElevenLabsKey();
if (elSource) {
  line(tick, `Bessere Stimme verfügbar — ElevenLabs-Schlüssel gefunden über ${elSource}.`);
} else {
  line(info, 'Kein ElevenLabs-Schlüssel gefunden — JARVIS nimmt die Browser-Stimme (völlig in Ordnung).');
  line(info, '  Optional: ELEVENLABS_API_KEY setzen für bessere Stimme und genaueres Gehör. Die kostenlose Stufe reicht.');
}

// --- How to run ----------------------------------------------------------
console.log('');
console.log('Starten mit einem Befehl:');
console.log('  npm start               # Gehirn und Gesicht zusammen');
console.log('');
console.log('Oder getrennt, in zwei Fenstern:');
console.log('  1)  npm run bridge      # das Gehirn (Claude Code, unsichtbar)');
console.log('  2)  npm run dev         # das Gesicht (http://localhost:5173 in Chrome)');
console.log('');
console.log('Dann auf AKTIVIEREN klicken und „Hey Jarvis“ sagen.');
console.log('Damit JARVIS wirklich handeln darf (Handy, Browser, Senden): `npm run bridge:writes` statt `npm run bridge`.');
console.log('');

process.exit(0);
