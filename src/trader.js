import { Connection, Keypair, VersionedTransaction, SystemProgram, Transaction, PublicKey } from '@solana/web3.js';
import fetch from 'node-fetch';
import bs58 from 'bs58';
import { sendStatus } from './alerts.js';
import { getCurrentSolPrice } from './alerts.js';

const connection = new Connection(
  'https://mainnet.helius-rpc.com/?api-key=' + process.env.HELIUS_API_KEY,
  'confirmed'
);

const TRADE_PERCENT = parseFloat(process.env.TRADE_PERCENT ?? '10') / 100;
const MAX_SOL       = parseFloat(process.env.MAX_SOL_PER_TRADE ?? '10');
const ENABLED       = process.env.COPY_TRADE_ENABLED === 'true';
const MIN_USD       = parseFloat(process.env.MIN_USD_THRESHOLD ?? '500');
const SOL_MINT      = 'So11111111111111111111111111111111111111112';
const USDC_MINT     = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const JUP_QUOTE     = 'https://lite.jup.ag/v6/quote';
const JUP_SWAP      = 'https://lite.jup.ag/v6/swap';
const JUP_FEE       = 0.003;
const NET_FEE_SOL   = 0.000005;

function getKeypair() {
  const key = process.env.PHANTOM_PRIVATE_KEY;
  if (!key) throw new Error('PHANTOM_PRIVATE_KEY not set');
  return Keypair.fromSecretKey(bs58.decode(key));
}

async function jupiterSwap(keypair, inputMint, outputMint, lamports) {
  const quoteUrl = JUP_QUOTE + '?inputMint=' + inputMint + '&outputMint=' + outputMint + '&amount=' + lamports + '&slippageBps=300';
  const quoteRes = await fetch(quoteUrl, { headers: { 'Accept': 'application/json' } });
  if (!quoteRes.ok) throw new Error('Jupiter quote failed: ' + quoteRes.status);
  const quote = await quoteRes.json();
  if (quote.error) throw new Error('Jupiter: ' + quote.error);

  const swapRes = await fetch(JUP_SWAP, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: keypair.publicKey.toBase58(),
      wrapAndUnwrapSol: true,
      prioritizationFeeLamports: 10000,
    }),
  });
  if (!swapRes.ok) throw new Error('Jupiter swap failed: ' + swapRes.status);
  const { swapTransaction } = await swapRes.json();

  const tx = VersionedTransaction.deserialize(Buffer.from(swapTransaction, 'base64'));
  tx.sign([keypair]);
  const sig = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false, maxRetries: 3,
  });
  return { sig, outAmount: quote.outAmount };
}

export async function copyTrade({ direction, token, amount_sol, label }) {
  if (!ENABLED) return;
  try {
    const solPrice = getCurrentSolPrice() || 150;
    const usdValue = amount_sol * solPrice;

    if (usdValue < MIN_USD) {
      console.log('[trader] Skip — $' + usdValue.toFixed(0) + ' below $' + MIN_USD);
      return;
    }

    const keypair    = getKeypair();
    const balance    = await connection.getBalance(keypair.publicKey);
    const balanceSol = balance / 1e9;

    let tradeSol = balanceSol * TRADE_PERCENT;
    tradeSol     = Math.min(tradeSol, MAX_SOL);
    tradeSol     = Math.max(tradeSol, 0.01);

    if (tradeSol > balanceSol * 0.95) {
      console.log('[trader] Not enough balance');
      return;
    }

    const isSOLMove = !token || token === 'SOL' || token === SOL_MINT;
    const tradeUsd  = tradeSol * solPrice;
    const netFee    = (tradeUsd * JUP_FEE) + (NET_FEE_SOL * solPrice);
    const lamports  = Math.floor(tradeSol * 1e9);

    let inputMint, outputMint, tradePath;
    if (direction === 'BUY') {
      inputMint  = SOL_MINT;
      outputMint = isSOLMove ? USDC_MINT : token;
      tradePath  = isSOLMove ? 'SOL -> USDC' : 'SOL -> ' + token.slice(0,8);
    } else {
      inputMint  = isSOLMove ? SOL_MINT : token;
      outputMint = USDC_MINT;
      tradePath  = isSOLMove ? 'SOL -> USDC' : token.slice(0,8) + ' -> USDC';
    }

    console.log('[trader] ' + direction + ' $' + tradeUsd.toFixed(2) + ' | ' + tradePath + ' | fees ~$' + netFee.toFixed(3));

    const { sig, outAmount } = await jupiterSwap(keypair, inputMint, outputMint, lamports);

    const outUsd    = outputMint === USDC_MINT ? outAmount / 1e6 : (outAmount / 1e9) * solPrice;
    const netProfit = outUsd - tradeUsd - netFee;

    await sendStatus(
      '✅ *Trade Executed*\n' +
      (direction === 'BUY' ? '🟢' : '🔴') + ' ' + direction + ' following *' + label + '*\n' +
      '💱 ' + tradePath + '\n' +
      '💰 Size: $' + tradeUsd.toFixed(2) + '\n' +
      '📊 Whale moved: $' + usdValue.toFixed(0) + '\n' +
      '💸 Fees: ~$' + netFee.toFixed(3) + '\n' +
      '📈 Net: $' + netProfit.toFixed(2) + '\n' +
      '🔗 [Solscan](https://solscan.io/tx/' + sig + ')'
    );

    console.log('[trader] Done: ' + sig + ' | net $' + netProfit.toFixed(2));

    if (netProfit > 0) {
      await sendProfitShare(netProfit / solPrice);
    }

    return netProfit;
  } catch (err) {
    console.error('[trader] Failed:', err.message);
    await sendStatus('⚠️ Trade failed: ' + err.message);
  }
}

export async function sendProfitShare(profitSol) {
  const wallet = process.env.PROFIT_WALLET;
  const pct    = parseFloat(process.env.PROFIT_PERCENT ?? '25') / 100;
  if (!wallet || profitSol <= 0) return;
  try {
    const keypair   = getKeypair();
    const solPrice  = getCurrentSolPrice() || 150;
    const amount    = Math.floor(profitSol * pct * 1e9);
    const profitUsd = profitSol * pct * solPrice;
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey:   new PublicKey(wallet),
        lamports:   amount,
      })
    );
    const sig = await connection.sendTransaction(tx, [keypair]);
    await sendStatus(
      '💸 *Profit -> Ledger*\n' +
      'Sent ' + (profitSol * pct).toFixed(4) + ' SOL (~$' + profitUsd.toFixed(2) + ')\n' +
      '🔗 [Solscan](https://solscan.io/tx/' + sig + ')'
    );
    console.log('[trader] Profit sent: ' + sig);
  } catch (err) {
    console.error('[trader] Profit transfer failed:', err.message);
  }
}
