import fetch from 'node-fetch';
import { upsertWhaleWallet, getWalletCount } from './db.js';

const LIMIT = parseInt(process.env.GMGN_WALLET_LIMIT ?? '20');

// GMGN public endpoints — no API key required
const GMGN_BASE = 'https://gmgn.ai/defi/quotation/v1';

/**
 * Fetch top smart money / whale wallets from GMGN Solana leaderboard.
 * GMGN exposes a public ranking endpoint used by their own frontend.
 */
export async function refreshWhaleWallets() {
  console.log('[GMGN] Refreshing whale wallet list...');

  try {
    // Top traders by PnL on Solana (7 day window)
    const url = `${GMGN_BASE}/rank/sol/wallets/7d?orderby=pnl&direction=desc&limit=${LIMIT}`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
        'Referer': 'https://gmgn.ai/',
      },
      timeout: 10000,
    });

    if (!res.ok) {
      throw new Error(`GMGN responded ${res.status}`);
    }

    const json = await res.json();
    const wallets = json?.data?.rank ?? json?.data ?? [];

    if (!wallets.length) {
      console.warn('[GMGN] No wallets returned — will retry next cycle');
      return 0;
    }

    let count = 0;
    for (const w of wallets) {
      const address = w.wallet_address ?? w.address;
      if (!address) continue;

      upsertWhaleWallet({
        address,
        label:    w.ens ?? w.tag ?? '',
        win_rate: parseFloat(w.winrate ?? w.win_rate ?? 0),
        pnl:      parseFloat(w.pnl ?? w.realized_profit ?? 0),
        source:   'gmgn',
      });
      count++;
    }

    console.log(`[GMGN] Loaded ${count} whale wallets into DB`);
    return count;

  } catch (err) {
    console.error('[GMGN] Failed to fetch wallets:', err.message);

    // Fallback: seed a few known Solana smart money wallets so bot still runs
    if (getWalletCount() === 0) {
      console.log('[GMGN] Seeding fallback known whale wallets...');
      const fallback = [
        { address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', label: 'Known whale 1' },
        { address: 'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh', label: 'Known whale 2' },
        { address: 'ArAHpnHgMBVtJamaBBBZiNkMpycyaXX6W5FHGZoMPPjA', label: 'Known whale 3' },
      ];
      for (const w of fallback) {
        upsertWhaleWallet({ ...w, win_rate: 0, pnl: 0, source: 'fallback' });
      }
    }
    return 0;
  }
}

/**
 * Start auto-refresh loop for whale wallet list.
 */
export function startGmgnRefresh() {
  const hours = parseFloat(process.env.GMGN_REFRESH_HOURS ?? '6');
  const ms = hours * 60 * 60 * 1000;

  refreshWhaleWallets(); // run immediately
  setInterval(refreshWhaleWallets, ms);
  console.log(`[GMGN] Auto-refresh every ${hours}h`);
}
