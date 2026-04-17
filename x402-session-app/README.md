# elsax402 demo app

A full-stack demo built with [`elsa-x402-sessions`](https://www.npmjs.com/package/elsa-x402-sessions) -- the session-based x402 micropayment SDK for Base / Base Sepolia (EVM).

This app shows how to integrate sign-once-settle-many payments into a real Next.js application. Users connect a wagmi-compatible wallet (MetaMask, Coinbase Wallet, WalletConnect), sign a single ERC20 `approve` to open a session, then every API call automatically settles micropayments on-chain via `transferFrom`. No per-request wallet popups.

## What's inside

### AI Chat (`/test2`)

A ChatGPT-style interface where every message costs $0.10 USDC settled on Base Sepolia. The user creates a session with a $1 cap and 1-hour expiry, then chats freely until the cap runs out. Each message triggers an on-chain `transferFrom` from the user's wallet to the resource server's wallet -- visible on https://sepolia.basescan.org.

- wagmi wallet connection (MetaMask / Coinbase Wallet / WalletConnect)
- Session creation with configurable cap/expiry
- Real-time session balance tracking
- LLM responses powered by vLLM on RunPod

### Slot Machine (`/slot`)

A slot machine where each pull of the lever is a $0.10 micropayment. Same session flow as the chat -- create once, pull many times. A fun, visual way to demonstrate high-frequency micropayments.

## How it works

```
User connects wallet (wagmi)
        |
        v
Signs ONE on-chain approve(facilitator, $1)
        |
        v
Session registered with facilitator (POST /sessions)
        |
        v
Every API call -> 402 -> SDK auto-retries with sessionId -> facilitator settles $0.10 on-chain
```

The heavy lifting is done by [`elsa-x402-sessions`](https://www.npmjs.com/package/elsa-x402-sessions):

- **Client side**: `createSession()` handles the approval tx + facilitator registration. `session.fetch()` is a drop-in `fetch` replacement that handles the 402 payment dance.
- **Server side**: `SessionEvmScheme` plugs into `@x402/next`'s payment proxy to protect any route with session-based payments.

## Quick start

```bash
git clone https://github.com/ayushsingh82/elsa402-sessions.git
cd elsa402-sessions/x402-session-app
npm install
cp .env.example .env.local
# Edit .env.local -- at minimum set NEXT_PUBLIC_RECIPIENT_ADDRESS and SERVER_WALLET_ADDRESS
npm run dev
```

Open http://localhost:3000/test2 (chat) or http://localhost:3000/slot (slot machine) in a browser with a wallet (MetaMask / Coinbase Wallet) switched to **Base Sepolia (chainId 84532)**.

You'll need a Base Sepolia EOA with:

- ETH for gas: https://www.alchemy.com/faucets/base-sepolia
- USDC for payments: https://faucet.circle.com (select Base Sepolia)

The hosted facilitator at `https://elsax402-facilitator-production.up.railway.app` is the default -- no setup needed.

## Environment variables

| Variable | Purpose |
|---|---|
| `NETWORK` / `NEXT_PUBLIC_NETWORK` | `base:sepolia` (default) or `base:mainnet` |
| `NEXT_PUBLIC_BASE_RPC_URL` | EVM RPC URL (default `https://sepolia.base.org`) |
| `USDC_CONTRACT_ADDRESS` / `NEXT_PUBLIC_USDC_ADDRESS` | ERC20 USDC address (defaults to canonical Circle USDC for the chosen network) |
| `SESSION_FACILITATOR_URL` / `NEXT_PUBLIC_SESSION_FACILITATOR_URL` | elsa-x402-sessions facilitator URL (default: hosted Railway instance) |
| `SERVER_WALLET_ADDRESS` / `NEXT_PUBLIC_RECIPIENT_ADDRESS` | Resource server wallet that receives micropayments |
| `PER_CALL_USDC` / `NEXT_PUBLIC_PER_CALL_USDC` | Per-call price in USDC (default `0.10`) |
| `X402_DEV_BYPASS` | Set `true` to skip payment during development |

## Built with

- [elsa-x402-sessions](https://www.npmjs.com/package/elsa-x402-sessions) -- session-based x402 SDK for Base
- [Next.js 16](https://nextjs.org)
- [wagmi](https://wagmi.sh) + [viem](https://viem.sh) -- EVM wallet + RPC
- [@x402/next](https://www.npmjs.com/package/@x402/next) -- x402 payment proxy middleware
- [Framer Motion](https://www.framer.com/motion/) -- animations
- Facilitator deployed on [Railway](https://railway.com)

## License

MIT
