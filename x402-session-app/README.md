# x402-session-app

A full-stack demo app built with [`x402-sessions`](https://www.npmjs.com/package/x402-sessions) — the session-based x402 micropayment SDK for Stellar.

This app shows how to integrate sign-once-settle-many payments into a real Next.js application. Users connect their Freighter wallet, create a session with a single on-chain approval, and then every API call automatically settles micropayments on-chain via SAC `transfer_from`. No per-request wallet popups.

## What's inside

### AI Chat (`/test2`)

A ChatGPT-style interface where every message costs $0.10 USDC settled on Stellar. The user creates a session with a $1 cap and 1-hour expiry, then chats freely until the cap runs out. Each message triggers an on-chain `transfer_from` — visible on the Stellar explorer.

- Freighter wallet connection
- Session creation with configurable cap/expiry
- Real-time session balance tracking
- LLM responses powered by vLLM on RunPod

### Slot Machine (`/slot`)

A slot machine where each pull of the lever is a $0.10 micropayment. Same session flow as the chat — create once, pull many times. A fun, visual way to demonstrate high-frequency micropayments on Stellar.

## How it works

```
User connects Freighter
        ↓
Signs ONE on-chain approve(facilitator, $1, 1hr)
        ↓
Session registered with facilitator
        ↓
Every API call → 402 → SDK auto-retries with sessionId → facilitator settles $0.10 on-chain
```

The heavy lifting is done by [`x402-sessions`](https://www.npmjs.com/package/x402-sessions):
- **Client side**: `createSession()` handles the approval tx + facilitator registration. `session.fetch()` is a drop-in `fetch` replacement that handles the 402 payment dance.
- **Server side**: `SessionStellarScheme` plugs into `@x402/next`'s payment proxy to protect any route with session-based payments.

## Quick start

```bash
git clone https://github.com/x402-sessions/x402-session-app.git
cd x402-session-app
npm install
cp .env.local.example .env.local
npm run dev
```

Open [http://localhost:3000/test2](http://localhost:3000/test2) (chat) or [http://localhost:3000/slot](http://localhost:3000/slot) (slot machine) in Chrome or Brave with the [Freighter](https://freighter.app) wallet extension set to **Testnet**.

## Environment variables

| Variable | Purpose |
|---|---|
| `SESSION_FACILITATOR_URL` | x402-sessions facilitator ([public testnet instance](https://courteous-emotion-production.up.railway.app) used by default) |
| `USDC_CONTRACT_ID` | SAC contract id for the USDC token |
| `SERVER_STELLAR_ADDRESS` | Resource server wallet that receives payments |
| `NEXT_PUBLIC_SESSION_FACILITATOR_URL` | Browser-side mirror of facilitator URL |
| `NEXT_PUBLIC_USDC_SAC_ID` | Browser-side mirror of USDC SAC id |
| `NEXT_PUBLIC_SERVER_STELLAR_ADDRESS` | Browser-side mirror of server wallet |
| `NEXT_PUBLIC_PER_CALL_USDC` | Per-call price in USDC (default `0.10`) |
| `VLLM_URL` | LLM backend URL for `/test2/chat` |
| `VLLM_MODEL` | Model name for the LLM backend |
| `X402_DEV_BYPASS` | Set `true` to skip payment during development |

## Built with

- [x402-sessions](https://www.npmjs.com/package/x402-sessions) — session-based x402 SDK for Stellar
- [Next.js 16](https://nextjs.org) + Turbopack
- [@x402/next](https://www.npmjs.com/package/@x402/next) — x402 payment proxy middleware
- [@stellar/freighter-api](https://www.npmjs.com/package/@stellar/freighter-api) — browser wallet
- [Framer Motion](https://www.framer.com/motion/) — animations
- Facilitator deployed on [Railway](https://railway.com)

## License

MIT
