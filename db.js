import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../data/whale.db');

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS seen_txns (
    signature  TEXT PRIMARY KEY,
    wallet     TEXT,
    amount_sol REAL,
    direction  TEXT,
    token      TEXT,
    token_name TEXT,
    seen_at    INTEGER DEFAULT (strftime('%s','now'))
  );

  CREATE TABLE IF NOT EXISTS whale_wallets (
    address    TEXT PRIMARY KEY,
    label      TEXT,
    win_rate   REAL,
    pnl        REAL,
    source     TEXT DEFAULT 'gmgn',
    updated_at INTEGER DEFAULT (strftime('%s','now'))
  );
`);

export function hasSeen(signature) {
  return !!db.prepare('SELECT 1 FROM seen_txns WHERE signature = ?').get(signature);
}

export function markSeen({ signature, wallet, amount_sol, direction, token, token_name }) {
  db.prepare(`
    INSERT OR IGNORE INTO seen_txns (signature, wallet, amount_sol, direction, token, token_name)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(signature, wallet, amount_sol, direction, token ?? 'SOL', token_name ?? '');
}

export function upsertWhaleWallet({ address, label, win_rate, pnl, source }) {
  db.prepare(`
    INSERT INTO whale_wallets (address, label, win_rate, pnl, source, updated_at)
    VALUES (?, ?, ?, ?, ?, strftime('%s','now'))
    ON CONFLICT(address) DO UPDATE SET
      label = excluded.label,
      win_rate = excluded.win_rate,
      pnl = excluded.pnl,
      updated_at = excluded.updated_at
  `).run(address, label ?? '', win_rate ?? 0, pnl ?? 0, source ?? 'gmgn');
}

export function getWhaleWallets() {
  return db.prepare('SELECT address, label, win_rate, pnl FROM whale_wallets ORDER BY pnl DESC').all();
}

export function getWalletCount() {
  return db.prepare('SELECT COUNT(*) as count FROM whale_wallets').get().count;
}

export default db;
