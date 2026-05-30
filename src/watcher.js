import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { hasSeen, markSeen, getWhaleWallets } from './db.js';
import { sendWhaleAlert } from './alerts.js';
import { copyTrade } from './trader.js';

const RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
const MIN_SOL = parseFloat(process.env.MIN_SOL_THRESHOLD ?? '20');
const POLL_MS = parseInt(process.env.POLL_INTERVAL_MS ?? '8000');

export const connection = new Connection(RPC_URL, 'confirmed');
const lastSig = new Map();

async function fetchEnhancedTx(signature) {
  try {
    const url = `https://api.helius.xyz/v0/transactions/?api-key=${process.env.HELIUS_API_KEY}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactions: [signature] }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.[0] ?? null;
  } catch { return null; }
}

async function parseTx(signature, wallet, label, win_rate, pnl) {
  try {
    const enhanced = await fetchEnhancedTx(signature);
    if (enhanced) {
      const accountData  = enhanced.accountData ?? [];
      const myAccount    = accountData.find(a => a.account === wallet);
      const nativeChange = myAccount?.nativeBalanceChange ?? 0;
      const absSol       = Math.abs(nativeChange) / LAMPORTS_PER_SOL;
      if (absSol < MIN_SOL) return null;
      const direction      = nativeChange < 0 ? 'BUY' : 'SELL';
      const tokenTransfers = enhanced.tokenTransfers ?? [];
      const myTransfer     = tokenTransfers.find(t => t.fromUserAccount === wallet || t.toUserAccount === wallet);
      const token          = myTransfer?.mint ?? 'SOL';
      const token_name     = myTransfer?.symbol ?? enhanced.events?.swap?.innerSwaps?.[0]?.tokenOutputs?.[0]?.symbol ?? '';
      return { wallet, label, direction, amount_sol: absSol, token, token_name, signature, win_rate, pnl };
    }
    const tx = await connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0, commitment: 'confirmed',
    });
    if (!tx?.meta) return null;
    const keys = tx.transaction.message.accountKeys;
    const idx  = keys.findIndex(k => k.pubkey.toBase58() === wallet);
    if (idx === -1) return null;
    const diff    = (tx.meta.postBalances[idx] - tx.meta.preBalances[idx]) / LAMPORTS_PER_SOL;
    const absDiff = Math.abs(diff);
    if (absDiff < MIN_SOL) return null;
    return { wallet, label, direction: diff < 0 ? 'BUY' : 'SELL', amount_sol: absDiff, token: 'SOL', token_name: '', signature, win_rate, pnl };
  } catch (err) {
    console.error(`[watcher] parseTx error ${signature.slice(0,8)}:`, err.message);
    return null;
  }
}

async function pollWallet({ address, label, win_rate, pnl }) {
  try {
    const pubkey = new PublicKey(address);
    const sigs   = await connection.getSignaturesForAddress(pubkey, { limit: 5, commitment: 'confirmed' });
    if (!sigs.length) return;
    if (!lastSig.has(address)) {
      lastSig.set(address, sigs[0].signature);
      return;
    }
    const cursor  = lastSig.get(address);
    const newSigs = [];
    for (const s of sigs) {
      if (s.signature === cursor) break;
      newSigs.push(s);
    }
    if (!newSigs.length) return;
    lastSig.set(address, newSigs[0].signature);
    for (const { signature, err } of newSigs) {
      if (err || hasSeen(signature)) continue;
      const alert = await parseTx(signature, address, label, win_rate, pnl);
      if (!alert) continue;
      markSeen(alert);
      await sendWhaleAlert(alert);
      console.log(`[ALERT] ${alert.direction} ${alert.amount_sol.toFixed(2)} SOL | ${label || address.slice(0,8)} | ${alert.token_name || alert.token}`);
      // 🔥 Execute copy trade
      await copyTrade(alert);
    }
  } catch (err) {
    console.error(`[watcher] poll error ${address.slice(0,8)}:`, err.message);
  }
}

export async function startWatcher() {
  console.log(`[watcher] Starting | threshold: ${MIN_SOL} SOL | poll: ${POLL_MS}ms`);
  const poll = async () => {
    const wallets = getWhaleWallets();
    if (!wallets.length) { console.log('[watcher] No whale wallets yet...'); return; }
    await Promise.allSettled(wallets.map(w => pollWallet(w)));
  };
  setTimeout(() => { poll(); setInterval(poll, POLL_MS); }, 5000);
}
