import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

/**
 * Get SOL balance of your Phantom wallet.
 * Uses your public key only — completely safe, read-only.
 */
export async function getPhantomBalance(connection) {
  const pubkey = process.env.PHANTOM_PUBLIC_KEY;
  if (!pubkey) {
    console.warn('[Phantom] PHANTOM_PUBLIC_KEY not set in .env');
    return null;
  }

  try {
    const key = new PublicKey(pubkey);
    const lamports = await connection.getBalance(key);
    const sol = lamports / LAMPORTS_PER_SOL;
    console.log(`[Phantom] Wallet balance: ${sol.toFixed(4)} SOL`);
    return sol;
  } catch (err) {
    console.error('[Phantom] Failed to fetch balance:', err.message);
    return null;
  }
}

/**
 * Format a short display version of your phantom wallet address.
 */
export function shortAddress(address) {
  if (!address) return 'N/A';
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export const PHANTOM_PUBLIC_KEY = process.env.PHANTOM_PUBLIC_KEY ?? '';
