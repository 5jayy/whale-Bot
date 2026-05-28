import TelegramBot from 'node-telegram-bot-api';
import { shortAddress } from './phantom.js';

let bot = null;

export function initTelegram() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn('[Telegram] No bot token set — alerts disabled');
    return;
  }
  bot = new TelegramBot(token);
  console.log('[Telegram] Bot ready');
}

const CHAT = () => process.env.TELEGRAM_CHAT_ID;

/**
 * Send a whale trade alert.
 */
export async function sendWhaleAlert({ wallet, label, direction, amount_sol, token, token_name, signature, win_rate, pnl }) {
  if (!bot || !CHAT()) return;

  const emoji   = direction === 'BUY' ? '🟢' : direction === 'SELL' ? '🔴' : '🔵';
  const name    = label ? `*${label}*` : `\`${shortAddress(wallet)}\``;
  const tkn     = token_name ? `${token_name}` : token ?? 'SOL';
  const stats   = win_rate ? `📊 Win rate: ${(win_rate * 100).toFixed(0)}%  |  PnL: $${Number(pnl).toLocaleString()}` : '';
  const solscan = `https://solscan.io/tx/${signature}`;

  const msg =
    `${emoji} *WHALE ${direction}* ${emoji}\n` +
    `👛 Wallet: ${name}\n` +
    `🪙 Token: *${tkn}*\n` +
    `💰 Amount: *${amount_sol.toFixed(2)} SOL*\n` +
    (stats ? `${stats}\n` : '') +
    `🔗 [View on Solscan](${solscan})`;

  await bot.sendMessage(CHAT(), msg, {
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
  }).catch(e => console.error('[Telegram] Send failed:', e.message));
}

/**
 * Send a plain status message.
 */
export async function sendStatus(text) {
  if (!bot || !CHAT()) return;
  await bot.sendMessage(CHAT(), text, { parse_mode: 'Markdown' })
    .catch(e => console.error('[Telegram] Status failed:', e.message));
}
