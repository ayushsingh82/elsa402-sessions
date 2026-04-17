# Elsa402-sessions  

[![npm](https://img.shields.io/npm/v/elsa-x402-sessions.svg)](https://www.npmjs.com/package/elsa-x402-sessions)
[![license](https://img.shields.io/npm/l/elsa-x402-sessions.svg)](./x402-session-sdk/LICENSE)

**Sign once, settle many times -- session-based x402 payments on Base Sepolia (USDC).**

A complete session-based x402 stack: a TypeScript SDK, a hosted facilitator, a demo Next.js app, and end-to-end test scripts. Powered by canonical Circle USDC on Base Sepolia and viem.

> Classic x402 = 1 request, 1 EIP-3009 signature, 1 settlement.
> **elsa-x402-sessions = 1 ERC20 `approve`, N settlements.**

## Live deployments

| What | URL |
|---|---|
| **SDK on npm** | [`elsa-x402-sessions`](https://www.npmjs.com/package/elsa-x402-sessions) |
| **Hosted facilitator** | https://elsax402-facilitator-production.up.railway.app |
| **GitHub** | https://github.com/ayushsingh82/elsa402-sessions |

Both are live on **Base Sepolia (chainId 84532)** with Circle USDC at `0x036CbD53842c5426634e7929541eC2318f3dCF7e`. Use the SDK + hosted facilitator with zero infrastructure.

## Try it in 60 seconds

```bash
npm install elsa-x402-sessions viem
```

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
  spendingCap: "1.00",        // 1 USDC total budget
  expiresIn: 3600,            // 1 hour
  recipient: "0xYourResourceServerWallet",
});

// Each call settles $0.10 on-chain via ERC20 transferFrom -- no popup, no resign.
for (let i = 0; i < 10; i++) {
  const res = await session.fetch("https://your-x402-protected-api.example/inference");
  console.log(await res.json());
}
```

The user EOA must hold Base Sepolia ETH (gas) and USDC. Faucets:

- ETH: https://www.alchemy.com/faucets/base-sepolia
- USDC: https://faucet.circle.com (select Base Sepolia)

## Resource-server side (`@x402/next`)

```ts
import { paymentProxy, x402ResourceServer } from "@x402/next";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { SessionEvmScheme, USDC_BASE_SEPOLIA } from "elsa-x402-sessions";

const facilitator = new HTTPFacilitatorClient({
  url: "https://elsax402-facilitator-production.up.railway.app",
});

const server = new x402ResourceServer(facilitator).register(
  "base:sepolia",
  new SessionEvmScheme({
    assetAddress: USDC_BASE_SEPOLIA,
    facilitatorUrl: "https://elsax402-facilitator-production.up.railway.app",
  }),
);

export const handler = paymentProxy(
  {
    "/api/inference": {
      accepts: [{
        scheme: "session" as const,
        price: "0.10",
        network: "base:sepolia",
        payTo: process.env.SERVER_WALLET_ADDRESS!,
      }],
      description: "AI inference, settled per request via session",
    },
  },
  server,
);
```

Any request to `/api/inference` without a session payload gets a 402. With a valid `sessionId`, it passes through and `$0.10` settles on-chain via `transferFrom`.

## Packages in this repo

| Path | Package | Purpose |
|---|---|---|
| [`x402-session-sdk/`](./x402-session-sdk) | [`elsa-x402-sessions`](https://www.npmjs.com/package/elsa-x402-sessions) | Client SDK (`createSession`, `wrapFetch`) + resource-server scheme plugin (`SessionEvmScheme`) |
| [`x402-session-facilitator/`](./x402-session-facilitator) | `elsa-x402-sessions-facilitator` | Express + SQLite + viem. Endpoints: `/verify`, `/settle`, `/sessions`, `/supported`. Deployed on Railway. |
| [`x402-session-app/`](./x402-session-app) | `elsax402-app` | Next.js 16 demo: slot machine + AI chat, both x402-protected (wagmi + viem wallet) |
| [`x402-session-tests/`](./x402-session-tests) | `elsa-x402-sessions-test` | tsx scripts: `gen` (keypairs), `dry-run` (full e2e), `status` (balances) |

## How the session model works

```
+--------------+                                        +---------------+
|  user wallet | --1. approve(facilitator, $1) -------->|   USDC ERC20  |
| (MetaMask /  |                                        |  (Base Sep.)  |
|  Coinbase)   |                                        |               |
+------+-------+                                        +-------^-------+
       |                                                        |
       | 2. POST /sessions {approvalTxHash, cap, expiresAt}     |
       v                                                        |
+--------------+    3. sessionId                                |
| elsax402-    |<----------------+                              |
| sessions     |                 |                              |
| facilitator  |                 |                              |
+------+-------+                 |                              |
       |          4. POST /api/chat (per call)                  |
       |          +--------------+---------------+              |
       |          +------> resource server (@x402/next)         |
       |<-- 5. /verify, /settle ----------------                |
       |--- 6. transferFrom(user, recipient, $0.10) ----------->|
       |                                                        |
       |                  7. ok + reply                         |
       |                  +------------> user                   |
       +--- decrement session (sqlite) -------------------------+
```

1. User signs **one** on-chain `approve(spender=facilitator, amount=cap)`.
2. SDK registers the approval with the facilitator (`POST /sessions`).
3. Facilitator decodes the approve tx, verifies on-chain `allowance()`, stores the session, returns a `sessionId`.
4. User hits any protected endpoint with `session.fetch(...)`. SDK handles the 402 dance automatically.
5. Resource server's `x402ResourceServer` calls facilitator `/verify` then `/settle`.
6. Facilitator runs `transferFrom(user, recipient, amount)` on-chain. The token contract enforces the allowance.
7. Response flows back to the user. `spent` counter atomically decrements remaining cap.

## Run the full local stack

```bash
git clone https://github.com/ayushsingh82/elsa402-sessions.git
cd elsa402-sessions

# 1. SDK -- only needed if you want a local-link build instead of the npm release
cd x402-session-sdk && npm install && npm run build && cd ..

# 2. Generate user + recipient EOAs (writes .env)
cd x402-session-tests && npm install && npm run gen
# Fund USER_ADDRESS via Alchemy + Circle faucets (see "Try it in 60 seconds" above)
cd ..

# 3. Run the e2e dry-run against the hosted facilitator
cd x402-session-tests && npm run dry-run

# 4. (Optional) Demo Next.js app
cd ../x402-session-app && npm install
cp .env.example .env.local   # set NEXT_PUBLIC_RECIPIENT_ADDRESS
npm run dev                  # http://localhost:3000/slot
```

To self-host the facilitator instead of using the Railway URL:

```bash
cd x402-session-facilitator && npm install
cp .env.example .env         # set FACILITATOR_PRIVATE_KEY (fund with Base Sepolia ETH)
npm run build && npm start   # listens on :4021
```

Then point your client at `http://localhost:4021`.

## Network defaults

| Setting | Value |
|---|---|
| Network | Base Sepolia |
| Chain ID | `84532` |
| RPC | `https://sepolia.base.org` |
| USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (Circle, 6 decimals) |
| Explorer | https://sepolia.basescan.org |
| Hosted facilitator | https://elsax402-facilitator-production.up.railway.app |

Mainnet works too -- set `NETWORK=base:mainnet`, USDC = `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`. (Hosted facilitator is testnet-only; spin up your own for mainnet.)

## Trust model

| Limit | Enforced by | Hardness |
|---|---|---|
| **Total cap** (e.g. $1) | ERC20 `approve` + `transferFrom` reverts past allowance | **On-chain** |
| **Expiry** (unix-ts) | Facilitator DB refuses settles past `expires_at` | Off-chain |
| **Per-call price** (e.g. $0.10) | Facilitator `/settle` refuses amounts > policy | Off-chain |
| **Recipient binding** | Facilitator only pays the pre-registered `recipient` | Off-chain |
| **Unused balance** | Funds never escrowed -- they stay in the user's wallet | **Native** |

The user can revoke at any time by calling `approve(spender, 0)` themselves.

## Wire format (session scheme)

- **Scheme:** `"session"`
- **Network:** `"base:sepolia"` | `"base:mainnet"` (also CAIP-2 `"eip155:84532"` / `"eip155:8453"`)
- **`PaymentPayload.payload`:** `{ sessionId: string }`
- **Facilitator HTTP API:**
  - `GET /supported` -- standard x402
  - `POST /verify` -- standard x402
  - `POST /settle` -- standard x402
  - `POST /sessions` -- new: register a session from a signed approval tx hash
  - `GET /sessions/:id` -- new: inspect remaining cap / spent / expiry
  - `GET /health` -- liveness

## License

MIT
