# elsax402-sessions

**Sign once, settle many times — session-based x402 payments on Base Sepolia (USDC).**

A monorepo containing a complete session-based x402 stack: a TypeScript SDK, a self-hosted facilitator, a demo Next.js app, and end-to-end test scripts. Powered by canonical Circle USDC on Base Sepolia and viem.

> Classic x402 = 1 request, 1 EIP-3009 signature, 1 settlement.
> **elsax402-sessions = 1 ERC20 `approve`, N settlements.**

## Packages

| Path | Package | Purpose |
|---|---|---|
| [`x402-session-sdk/`](./x402-session-sdk) | [`elsax402-sessions`](./x402-session-sdk) | TypeScript SDK (npm-publishable) — `createSession`, `wrapFetch`, `SessionEvmScheme` |
| [`x402-session-facilitator/`](./x402-session-facilitator) | `elsax402-sessions-facilitator` | Express + SQLite + viem facilitator: `/verify`, `/settle`, `/sessions`, `/supported` |
| [`x402-session-app/`](./x402-session-app) | `elsax402-app` | Next.js 16 demo: slot machine + AI chat, both x402-protected (wagmi + viem wallet) |
| [`x402-session-tests/`](./x402-session-tests) | `elsax402-sessions-test` | tsx scripts: `gen` (keypairs), `dry-run` (full e2e), `status` (balances) |

## How the session model works

```
┌──────────────┐                                        ┌───────────────┐
│  user wallet │──1. approve(facilitator, $1) ─────────▶│   USDC ERC20  │
│ (MetaMask /  │                                        │  (Base Sep.)  │
│  Coinbase)   │                                        │               │
└──────┬───────┘                                        └───────▲───────┘
       │                                                        │
       │ 2. POST /sessions {approvalTxHash, cap, expiresAt}     │
       ▼                                                        │
┌──────────────┐    3. sessionId                                 │
│ elsax402-    │◀─────────────────┐                              │
│ sessions     │                  │                              │
│ facilitator  │                  │                              │
└──────┬───────┘                  │                              │
       │           4. POST /api/chat (per call)                  │
       │           ┌──────────────┴───────────────┐              │
       │           └──────▶ resource server (@x402/next)         │
       │◀── 5. /verify, /settle ─────────────────                │
       │──── 6. transferFrom(user, recipient, $0.10) ───────────▶│
       │                                                         │
       │                   7. ok + reply                         │
       │                   └──────────────▶ user                 │
       └──── decrement session (sqlite) ─────────────────────────┘
```

1. User signs **one** on-chain `approve(spender=facilitator, amount=cap)`.
2. SDK registers the approval with the facilitator (`POST /sessions`).
3. Facilitator decodes the approve tx, verifies on-chain `allowance()`, stores the session, returns a `sessionId`.
4. User hits any protected endpoint with `session.fetch(...)`. SDK handles the 402 dance automatically.
5. Resource server's `x402ResourceServer` calls facilitator `/verify` then `/settle`.
6. Facilitator runs `transferFrom(user, recipient, amount)` on-chain. The token contract enforces the allowance.
7. Response flows back to the user. `spent` counter atomically decrements remaining cap.

## Quickstart (full local stack)

```bash
# 1. Build the SDK
cd x402-session-sdk && npm install && npm run build && cd ..

# 2. Generate user + recipient EOAs
cd x402-session-tests && npm install && npm run gen && cd ..
# → fund USER_ADDRESS at https://www.alchemy.com/faucets/base-sepolia + https://faucet.circle.com

# 3. Start the facilitator (needs a funded private key in .env)
cd x402-session-facilitator && npm install
cp .env.example .env  # set FACILITATOR_PRIVATE_KEY (also fund the address with Base Sepolia ETH)
npm run build && npm start &
cd ..

# 4. Run the e2e dry-run
cd x402-session-tests && npm run dry-run

# 5. (Optional) Run the demo Next.js app
cd ../x402-session-app && npm install
cp .env.example .env.local  # set NEXT_PUBLIC_RECIPIENT_ADDRESS
npm run dev  # → http://localhost:3000/slot
```

## Network defaults

| Setting | Value |
|---|---|
| Network | Base Sepolia |
| Chain ID | `84532` |
| RPC | `https://sepolia.base.org` |
| USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (Circle, 6 decimals) |
| Explorer | https://sepolia.basescan.org |
| ETH faucet | https://www.alchemy.com/faucets/base-sepolia |
| USDC faucet | https://faucet.circle.com |

Mainnet works too — set `NETWORK=base:mainnet` (USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`).

## Trust model

| Limit | Enforced by | Hardness |
|---|---|---|
| **Total cap** (e.g. $1) | ERC20 `approve` + `transferFrom` reverts past allowance | **On-chain** |
| **Expiry** (unix-ts) | Facilitator DB refuses settles past `expires_at` | Off-chain |
| **Per-call price** (e.g. $0.10) | Facilitator `/settle` refuses amounts > policy | Off-chain |
| **Recipient binding** | Facilitator only pays the pre-registered `recipient` | Off-chain |
| **Unused balance** | Funds never escrowed — they stay in the user's wallet | **Native** |

The user can revoke at any time by calling `approve(spender, 0)` themselves.

## License

MIT
