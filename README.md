# 🐋 Whale Bot V2

Automatically tracks Solana whale wallets from GMGN, watches their transactions via Helius, and sends instant Telegram alerts — linked to your Phantom wallet.

## Stack
- **GMGN** — auto-discovers top smart money wallets (free, no key needed)
- **Helius** — monitors transactions via enhanced RPC (free tier)
- **Phantom** — your wallet displayed in alerts and startup message
- **Telegram** — instant alerts on your phone
- **Fly.io** — always-on VPS hosting (~$2–5/mo)

---

## Step 1 — Install Node.js
Download from https://nodejs.org (use v20 LTS)

## Step 2 — Open in VSCode
```bash
# Open the folder in VSCode
code whale-bot-v2

# Install dependencies in the VSCode terminal
npm install
```

## Step 3 — Set up your .env
```bash
cp .env.example .env
```
Then open `.env` and fill in:

| Key | Where to get it |
|-----|----------------|
| `HELIUS_API_KEY` | [helius.dev](https://helius.dev) → Sign up free → Dashboard → API Key |
| `PHANTOM_PUBLIC_KEY` | Open Phantom → copy your wallet address (public key only) |
| `TELEGRAM_BOT_TOKEN` | Telegram → search [@BotFather](https://t.me/botfather) → /newbot |
| `TELEGRAM_CHAT_ID` | Telegram → search [@userinfobot](https://t.me/userinfobot) → /start |

## Step 4 — Run locally in VSCode
Press **F5** or open the terminal and run:
```bash
npm run dev
```
You'll see:
```
🐋 Whale Bot starting...
[Phantom] Wallet balance: 2.4500 SOL
[GMGN] Loaded 20 whale wallets into DB
[watcher] Starting | threshold: 20 SOL | poll: 8000ms
✅ Whale Bot running. Watching for whale moves...
```
And your Telegram will get a startup message.

---

## Deploy to Fly.io

```bash
# 1. Install flyctl
curl -L https://fly.io/install.sh | sh

# 2. Login
fly auth login

# 3. Launch app (first time only)
fly launch --name whale-bot-v2 --no-deploy

# 4. Create persistent volume for SQLite
fly volumes create whale_data --size 1 --region iad

# 5. Set your secrets (keeps keys out of fly.toml)
fly secrets set HELIUS_API_KEY="your_key_here"
fly secrets set PHANTOM_PUBLIC_KEY="your_phantom_pubkey"
fly secrets set TELEGRAM_BOT_TOKEN="your_token"
fly secrets set TELEGRAM_CHAT_ID="your_chat_id"
fly secrets set MIN_SOL_THRESHOLD="20"
fly secrets set POLL_INTERVAL_MS="8000"
fly secrets set GMGN_REFRESH_HOURS="6"
fly secrets set GMGN_WALLET_LIMIT="20"

# 6. Deploy
fly deploy

# 7. Watch live logs
fly logs
```

---

## How it works

1. On startup, GMGN is queried for the top 20 wallets by 7-day PnL on Solana
2. Helius polls each wallet every 8 seconds for new transactions
3. Any transaction over your `MIN_SOL_THRESHOLD` triggers a Telegram alert
4. The whale wallet list auto-refreshes every 6 hours
5. SQLite prevents duplicate alerts

## Telegram alert format
```
🟢 WHALE BUY 🟢
👛 Wallet: CryptoWhale
🪙 Token: BONK
💰 Amount: 45.20 SOL
📊 Win rate: 78%  |  PnL: $124,500
🔗 View on Solscan
```

## File structure
```
whale-bot-v2/
├── src/
│   ├── index.js     ← entry point, boots everything
│   ├── gmgn.js      ← fetches whale wallets from GMGN
│   ├── watcher.js   ← polls Helius for new transactions
│   ├── phantom.js   ← reads your Phantom wallet balance
│   ├── alerts.js    ← sends Telegram messages
│   └── db.js        ← SQLite for wallets + dedup
├── .vscode/
│   ├── launch.json  ← F5 to run in VSCode
│   └── settings.json
├── data/            ← whale.db lives here (gitignored)
├── Dockerfile
├── fly.toml
├── .env.example
└── package.json
```
