import 'dotenv/config';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

// Ensure data folder exists
const __dirname = path.dirname(fileURLToPath(import.meta.url));
mkdirSync(path.join(__dirname, '../data'), { recursive: true });

import { initTelegram, sendStatus } from './alerts.js';
import { startGmgnRefresh } from './gmgn.js';
import { startWatcher, connection } from './watcher.js';
import { getPhantomBalance, shortAddress, PHANTOM_PUBLIC_KEY } from './phantom.js';

// ── Validate required env vars ────────────────────────────────
const required = ['HELIUS_API_KEY', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`❌ Missing required env var: ${key}`);
    process.exit(1);
  }
}

// ── Boot ──────────────────────────────────────────────────────
console.log('🐋 Whale Bot starting...');

initTelegram();

// Get Phantom wallet balance on startup
const balance = await getPhantomBalance(connection);
const walletLine = PHANTOM_PUBLIC_KEY
  ? `👛 My wallet: \`${shortAddress(PHANTOM_PUBLIC_KEY)}\` | ${balance?.toFixed(4) ?? '?'} SOL`
  : '';

// Send startup message to Telegram
await sendStatus(
  `🐋 *Whale Bot Online*\n` +
  `${walletLine}\n` +
  `📡 Connecting to GMGN + Helius...\n` +
  `🔔 Min alert threshold: *${process.env.MIN_SOL_THRESHOLD ?? 20} SOL*`
);

// Start GMGN wallet refresh (runs immediately, then every N hours)
startGmgnRefresh();

// Start Helius transaction watcher
await startWatcher();

console.log('✅ Whale Bot running. Watching for whale moves...');
