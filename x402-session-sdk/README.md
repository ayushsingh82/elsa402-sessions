# elsa-x402-sessions

[![npm](https://img.shields.io/npm/v/elsa-x402-sessions)](https://www.npmjs.com/package/elsa-x402-sessions)

**Sign once, settle many times — session-based x402 payments on Base.**

A tiny TypeScript SDK that turns a single ERC20 `approve` into an unlimited stream of x402 micropayments on Base / Base Sepolia. Pay $1 upfront, then every API call automatically settles $0.10 on-chain via `transferFrom`. No per-call wallet popup. The cap and expiry are enforced by the facilitator (off-chain bookkeeping) plus on-chain ERC20 allowance.

> Classic x402 = 1 request, 1 EIP-3009 signature, 1 settlement.
> **elsa-x402-sessions = 1 ERC20 approve, N settlements.**

## Why

If you're building an AI agent, a dapp game, a pay-per-inference API, or anything where a user makes many small payments in a row, classic x402 / HeyElsa `exact` becomes friction theatre — one wallet popup per request. This package is the EVM session model: one on-chain `approve(facilitator, cap)`, then the facilitator `transferFrom`s per call.

- **On-chain enforcement of the cap** via ERC20 `approve` + `transferFrom` (the token contract reverts past the allowance).
- **Zero escrow.** Unused allowance stays in the user's wallet.
- **Works with the existing x402 protocol.** Registers as a new scheme (`session`) alongside Coinbase's `exact`. Drop-in on the resource-server side via `@x402/core`'s `x402ResourceServer.register()`.
- **Tiny wire format.** The retry `PaymentPayload.payload` is just `{ sessionId }`.

## Install

```bash
npm install elsa-x402-sessions viem
# if you're also building the resource-server side:
npm install @x402/core @x402/next
```

Peer deps: `viem ^2.21`, `@x402/core ^2.8.0` (optional — only if you use the server-side scheme plugin).

You also need a running **elsa-x402-sessions facilitator** — a small service that verifies sessions and performs the on-chain `transferFrom`.

**Public facilitator:** `https://elsax402-facilitator-production.up.railway.app`

Use this URL directly in `facilitatorUrl` for testing on Base Sepolia. The reference implementation lives in [`x402-session-facilitator/`](https://github.com/ayushsingh82/elsa402-sessions/tree/main/x402-session-facilitator) -- clone and deploy your own to Railway when you're ready for production.

## 30-second quickstart

### 1. Client side (Node)

```ts
import { createSession, walletClientFromPrivateKey, USDC_BASE_SEPOLIA } from "elsa-x402-sessions";

const walletClient = await walletClientFromPrivateKey(
  process.env.USER_PRIVATE_KEY as `0x${string}`,
  "base:sepolia",
);

const session = await createSession({
  walletClient,
  facilitatorUrl: "https://elsax402-facilitator-production.up.railway.app",
  network: "base:sepolia",
  asset: USDC_BASE_SEPOLIA,
  spendingCap: "1.00",
  expiresIn: 3600,
  recipient: "0xYourResourceServerWallet",
});

// session.fetch is a drop-in fetch that transparently pays per call.
for (let i = 0; i < 10; i++) {
  const res = await session.fetch("https://yourapi.example/inference");
  console.log(await res.json()); // each call settles $0.10 on-chain
}
```

### 2. Client side (browser with wagmi)

```ts
import { useWalletClient } from "wagmi";
import { createSession, USDC_BASE_SEPOLIA } from "elsa-x402-sessions";

function Demo() {
  const { data: walletClient } = useWalletClient();

  async function start() {
    if (!walletClient) return;
    const session = await createSession({
      walletClient,
      facilitatorUrl: process.env.NEXT_PUBLIC_FACILITATOR_URL!,
      network: "base:sepolia",
      asset: USDC_BASE_SEPOLIA,
      spendingCap: "1.00",
      expiresIn: 3600,
      recipient: process.env.NEXT_PUBLIC_RECIPIENT! as `0x${string}`,
    });
    await session.fetch("/api/chat", {
      method: "POST",
      body: JSON.stringify({ prompt: "hi" }),
      headers: { "Content-Type": "application/json" },
    });
  }
}
```

### 3. Resource-server side (Next.js + `@x402/next`)

```ts
import { paymentProxy, x402ResourceServer } from "@x402/next";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { SessionEvmScheme, USDC_BASE_SEPOLIA } from "elsa-x402-sessions";

const facilitator = new HTTPFacilitatorClient({
  url:
    process.env.SESSION_FACILITATOR_URL ??
    "https://elsax402-facilitator-production.up.railway.app",
});

const server = new x402ResourceServer(facilitator).register(
  "base:sepolia",
  new SessionEvmScheme({
    assetAddress: USDC_BASE_SEPOLIA,
    facilitatorUrl: process.env.SESSION_FACILITATOR_URL,
  }),
);

export const handler = paymentProxy(
  {
    "/api/chat": {
      accepts: [
        {
          scheme: "session" as const,
          price: "0.10",
          network: "base:sepolia",
          payTo: process.env.SERVER_WALLET_ADDRESS!,
        },
      ],
      description: "AI chat, settled per message via session",
    },
  },
  server,
);
```

That's it. Any request to `/api/chat` without a session payload gets a 402. With one, it passes through and $0.10 settles on-chain via ERC20 `transferFrom`.

## How it works

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
3. Facilitator verifies on-chain allowance via `allowance()`, stores the session, returns a `sessionId`.
4. User hits protected endpoint with `session.fetch(...)`. SDK handles the 402 dance automatically (PAYMENT-REQUIRED → PAYMENT-SIGNATURE).
5. Resource server's `x402ResourceServer` calls facilitator `/verify` then `/settle`.
6. Facilitator runs `transferFrom(user, recipient, amount)` on-chain. The token contract enforces the allowance.
7. Response flows back to the user. Spent counter decrements.

## API reference

### `createSession(options)`

Signs + submits the on-chain `approve`, registers the session with the facilitator, and returns a `SessionHandle`.

```ts
function createSession(opts: CreateSessionOptions): Promise<SessionHandle>

interface CreateSessionOptions {
  walletClient: WalletClient;        // viem WalletClient with .account
  facilitatorUrl: string;            // e.g. "https://elsax402-facilitator-production.up.railway.app"
  network?: "base:sepolia" | "base:mainnet" | "eip155:84532" | "eip155:8453";
  asset: `0x${string}`;              // ERC20 token address (USDC)
  spendingCap: string;               // human units, e.g. "1.00"
  decimals?: number;                 // default 6 (USDC)
  expiresIn: number;                 // seconds; converted to unix-ts
  recipient: `0x${string}`;          // payTo address
  publicClient?: PublicClient;       // optional override
  rpcUrl?: string;                   // optional override
}

interface SessionHandle {
  sessionId: string;
  user: `0x${string}`;
  spender: `0x${string}`;
  asset: `0x${string}`;
  recipient: `0x${string}`;
  cap: string;            // base units (1e6 per USDC)
  spent: string;          // base units
  expiresAt: number;      // unix seconds
  network: Network;
  facilitatorUrl: string;
  fetch: typeof fetch;    // auto-paying fetch
}
```

### `wrapFetch(sessionId)`

Lower-level helper. Returns a `fetch`-compatible function that, on receiving a 402, reads the `PAYMENT-REQUIRED` header, builds a `PaymentPayload` with the given `sessionId`, and retries with `PAYMENT-SIGNATURE`. Use this if you want to manage the session handle yourself (e.g. persist it across pages).

### `SessionEvmScheme`

Resource-server plugin for `@x402/core`'s `x402ResourceServer.register()`.

```ts
class SessionEvmScheme {
  constructor(config: {
    assetAddress: `0x${string}`;     // ERC20 contract address
    decimals?: number;               // default 6
    facilitatorUrl?: string;         // exposed to clients in 402.extra
  });
}
```

### Helpers

```ts
import {
  USDC_BASE_SEPOLIA,                // 0x036CbD53842c5426634e7929541eC2318f3dCF7e
  USDC_BASE_MAINNET,                // 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
  DEFAULT_DECIMALS,                 // 6
  ERC20_ABI,
  chainFor,                         // network -> viem Chain
  defaultRpcUrlFor,                 // network -> default public RPC URL
  defaultUsdcFor,                   // network -> default USDC address
  decimalToBaseUnits,               // "1.50" + 6 decimals -> 1500000n
  makePublicClient,                 // (network, rpcUrl?) -> PublicClient
  walletClientFromPrivateKey,       // node-side WalletClient builder
  approveERC20,                     // submit approve(spender, amount)
  readAllowance,                    // read on-chain allowance(owner, spender)
  readBalanceOf,                    // read on-chain balanceOf(account)
  getNowSeconds,
} from "elsa-x402-sessions";
```

## Wire format (session scheme)

- **Scheme:** `"session"`
- **Network:** `"base:sepolia"` | `"base:mainnet"` (also `"eip155:84532"` / `"eip155:8453"` aliases)
- **`PaymentPayload.payload`** (the scheme-specific slot): `{ sessionId: string }`
- **Facilitator HTTP surface** (added to the standard x402 triplet):
  - `GET  /supported` — standard x402
  - `POST /verify`    — standard x402
  - `POST /settle`    — standard x402
  - `POST /sessions`  — **new**: register a session from a signed approval tx hash
  - `GET  /sessions/:id` — **new**: inspect remaining cap / spent / expiry

## Trust model

| Limit | Enforced by | Hardness |
|---|---|---|
| **Total cap** (e.g. $1) | ERC20 `approve` + `transferFrom` reverts past allowance | **On-chain** |
| **Expiry** (unix-ts) | Facilitator DB refuses settles past `expires_at` | Off-chain |
| **Per-call price** (e.g. $0.10) | Facilitator `/settle` refuses amounts > policy | Off-chain |
| **Recipient binding** | Facilitator only pays the pre-registered `recipient` | Off-chain |
| **Session reuse control** | Facilitator sqlite bookkeeping | Off-chain |
| **Unused balance handling** | Funds never escrowed — they stay in the user's wallet | **Native** |

The user can revoke at any time by calling `approve(spender, 0)` themselves.

## Faucets

- **Base Sepolia ETH (gas):** https://www.alchemy.com/faucets/base-sepolia
- **Base Sepolia USDC:** https://faucet.circle.com (select Base Sepolia)

## License

MIT
