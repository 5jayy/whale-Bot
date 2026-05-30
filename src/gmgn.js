import fetch from 'node-fetch';
import { upsertWhaleWallet } from './db.js';

const LIMIT = parseInt(process.env.GMGN_WALLET_LIMIT ?? '20');

export async function refreshWhaleWallets() {
  console.log('[GMGN] Refreshing whale wallet list...');
  try {
    const knownWhales = [
      { address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', label: 'Meme Trader 1' },
      { address: 'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh', label: 'Meme Trader 2' },
      { address: 'ArAHpnHgMBVtJamaBBBZiNkMpycyaXX6W5FHGZoMPPjA', label: 'Meme Trader 3' },
      { address: '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1', label: 'Raydium Authority' },
      { address: 'GThUX1Atko4tqhN2NaiTazWSeFWMuiUvfFnyJyUghFMJ', label: 'Meme Trader 4' },
      { address: 'ASTyfSima4LLAdDgoFGkgqoKowG1LZFDr9fAQrg7iaJZ', label: 'Meme Trader 5' },
      { address: 'AC5RDfQFmDS1deWZos921JfqscXdByf8BKHs5acaAfXi', label: 'Meme Trader 6' },
      { address: 'rFqFJ9g7TGBD8Ed7TPDnvGKZ5pWLPDyxLcvcH2eRCtt',  label: 'Meme Trader 7' },
      { address: 'DdZR6zRFiUt4S5mg7AV1uKB2z1f1WzcNYCaTEjwFdKix', label: 'Meme Trader 8' },
      { address: 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH', label: 'Meme Trader 9' },
      { address: 'CsUqfAiSFQMxTxBVQJQSanMGUyU3mYSPMDEQNMFXiCMr', label: 'Meme Trader 10' },
      { address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', label: 'Meme Trader 11' },
      { address: 'Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE', label: 'Meme Trader 12' },
      { address: 'G9tt98aYSznRk7jWsfuz9FnTdokxS6Brohdo9hSmjTRB', label: 'Pump Trader 1' },
      { address: 'TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM',  label: 'Pump Trader 2' },
      { address: '4MFEyMFLFNuqtgHmWWMJuLCDRkjSgFUDYGGBiMb3dMkP', label: 'Pump Trader 3' },
      { address: 'Hm3AMBPC2n4kpJQAGBnNKxBNAHAFdCABkMNSXiJXiJkT', label: 'Pump Trader 4' },
      { address: 'BcXknr8KB5kNEAsycTDDCBJqFRH3gmBhCFgqHVEJBXgF',  label: 'Pump Trader 5' },
      { address: 'FWznbcNXWQuHTawe9RxvQ2LdCENssh12dsznf4RiouN5',  label: 'Pump Trader 6' },
      { address: 'EhhTKczWMGQt46ynNeRX1WfeagwwJd7ufHvCDjRxjo5Q',  label: 'Pump Trader 7' },
    ];
    let count = 0;
    for (const w of knownWhales.slice(0, LIMIT)) {
      upsertWhaleWallet({ ...w, win_rate: 0, pnl: 0, source: 'static' });
      count++;
    }
    console.log('[GMGN] Loaded ' + count + ' whale wallets into DB');
    return count;
  } catch (err) {
    console.error('[GMGN] Failed:', err.message);
    return 0;
  }
}

export function startGmgnRefresh() {
  const hours = parseFloat(process.env.GMGN_REFRESH_HOURS ?? '6');
  const ms = hours * 60 * 60 * 1000;
  refreshWhaleWallets();
  setInterval(refreshWhaleWallets, ms);
  console.log('[GMGN] Auto-refresh every ' + hours + 'h');
}
