import TelegramBot from 'node-telegram-bot-api';
import fetch from 'node-fetch';
import { shortAddress } from './phantom.js';

let bot = null;
let solPrice = 0;

async function getSolPrice() {
  try {
    const res = await fetch('https://price.jup.ag/v6/price?ids=SOL');
    const data = await res.json();
    solPrice = data?.data?.SOL?.price ?? 0;
  } catch { }
}

// Refresh SOL price every 60 seconds
getSolPrice();
setInterval(getSolPrice, 60000);

export function initTelegram() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) { console.warn('[Telegram] No bot token set'); return; }
  bot = new TelegramBot(token);
  console.log('[Telegram] Bot ready');
}

const CHAT = () => process.env.TELEGRAM_CHAT_ID;

export async function sendWhaleAlert({ wallet, label, direction, amount_sol, token, token_name, signature, win_rate, pnl }) {
  if (!bot || !CHAT()) return;

  const emoji   = direction === 'BUY' ? '🟢' : direction === 'SELL' ? '🔴' : '🔵';
  const name    = label ? `*${label}*` : `\`${shortAddress(wallet)}\``;
  const tkn     = token_name || token || 'SOL';
  const usd     = solPrice ? ` (~$${(amount_sol * solPrice).toLocaleString('en-US', {maximumFractionDigits: 0})})` : '';
  const stats   = win_rate ? `📊 Win rate: ${(win_rate * 100).toFixed(0)}%  |  PnL: $${Number(pnl).toLocaleString()}` : '';
  const solscan = `https://solscan.io/tx/${signature}`;

  const msg =
    `${emoji} *WHALE ${direction}* ${emoji}\n` +
    `👛 Wallet: ${name}\n` +
    `🪙 Token: *${tkn}*\n` +
    `💰 Amount: *${amount_sol.toFixed(2)} SOL${usd}*\n` +
    (stats ? `${stats}\n` : '') +
    `🔗 [View on Solscan](${solscan})`;

  await bot.sendMessage(CHAT(), msg, {
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
  }).catch(e => console.error('[Telegram] Send failed:', e.message));
}

export async function sendStatus(text) {
  if (!bot || !CHAT()) return;
  await bot.sendMessage(CHAT(), text, { parse_mode: 'Markdown' })
    .catch(e => console.error('[Telegram] Status failed:', e.message));
}

export function getCurrentSolPrice() { return solPrice; }
