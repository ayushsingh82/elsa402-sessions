# elsax402-sessions facilitator

Reference HTTP facilitator for the `session` scheme on Base / Base Sepolia (EVM). Companion to the [`elsax402-sessions`](../x402-session-sdk) SDK.

Implements the x402 facilitator API (`GET /supported`, `POST /verify`, `POST /settle`) plus a session-management extension (`POST /sessions`, `GET /sessions/:id`) and performs on-chain ERC20 `transferFrom` calls.

## How it works

1. Client (via the [`elsax402-sessions`](../x402-session-sdk) SDK) signs & submits ERC20 `approve(facilitator, cap)` on-chain.
2. Client `POST`s the tx hash to `/sessions`. Facilitator decodes the tx, verifies it is `approve(spender=facilitator, value>=cap)` against the expected ERC20 contract, also reads live `allowance()` as a defense-in-depth check, stores a session record in sqlite, returns a `sessionId`.
3. Client attaches `sessionId` to subsequent `PAYMENT-SIGNATURE` headers on protected requests.
4. Resource server's x402 middleware calls `/verify` and `/settle`. Facilitator checks the session (cap, expiry, recipient, per-call limit), atomically debits sqlite, then executes ERC20 `transferFrom(user, recipient, amount)`.

On-chain hard guarantee: **total cap** (the ERC20 contract reverts past the allowance).
Off-chain facilitator policy: **expiry**, **per-call price limit**, **recipient binding**, **session bookkeeping**.

## Setup

```bash
npm install
cp .env.example .env
# Edit .env — set FACILITATOR_PRIVATE_KEY to a hex private key funded with Base Sepolia ETH
npm run dev
```

### Fund the facilitator address

The facilitator EOA needs Base Sepolia ETH to pay gas for `transferFrom` calls.

- ETH faucet: https://www.alchemy.com/faucets/base-sepolia
- USDC faucet (for testing user balances): https://faucet.circle.com (select **Base Sepolia**)

### Generate a fresh keypair

```bash
node -e "const {generatePrivateKey,privateKeyToAccount}=require('viem/accounts');const k=generatePrivateKey();console.log('PRIVATE_KEY=',k);console.log('ADDRESS=',privateKeyToAccount(k).address);"
```

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET  | `/health` | Liveness check |
| GET  | `/supported` | x402 spec: list supported `(scheme, network)` kinds and signer addresses |
| POST | `/verify` | x402 spec: stateless check that a session payload is valid |
| POST | `/settle` | x402 spec: re-verify + debit session + execute on-chain `transferFrom` |
| POST | `/sessions` | Create a session from a signed approval tx hash |
| GET  | `/sessions/:id` | Inspect session state (cap, spent, expiry) |

## POST /sessions request shape

```json
{
  "approvalTxHash": "0xabc...",
  "user": "0x...payer",
  "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  "recipient": "0x...resource_server",
  "cap": "1000000",
  "expiresAt": 1769000000,
  "network": "base:sepolia"
}
```

`cap` is in base units (USDC has 6 decimals, so `1000000` = 1.00 USDC). `expiresAt` is unix seconds.

## Env vars

```
PORT=4021
NETWORK=base:sepolia
NETWORK_CAIP=eip155:84532
CHAIN_ID=84532
BASE_RPC_URL=https://sepolia.base.org
FACILITATOR_PRIVATE_KEY=0x...    # funded EOA
USDC_CONTRACT_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
ASSET_DECIMALS=6
MAX_PER_CALL=1.00                # decimal; /settle refuses calls above this
DB_PATH=./sessions.db
```

## Storage

`better-sqlite3`, WAL mode. One table: `sessions`. Atomic debit under a sqlite transaction so concurrent `/settle` calls can't double-spend the session.

## Known limitations (v1)

- **No native on-chain expiry**: ERC20 `approve` is permanent until revoked. Expiry is enforced off-chain in the facilitator DB. The user can revoke at any time by calling `approve(spender, 0)` themselves; if you trust the facilitator, that's enough.
- **On-chain rollback after debit**: if sqlite debit succeeds but `transferFrom` fails (e.g. user revoked between verify and settle), we automatically refund the session balance and return `errorReason: "onchain_transfer_failed"`.
- **Per-call policy is trust-based**: the facilitator promises not to overspend per call, but on-chain the ERC20 only enforces the total allowance.
- **Single facilitator address**: no key rotation or load balancing. Use a process manager for HA.

## References

- USDC on Base Sepolia: `0x036CbD53842c5426634e7929541eC2318f3dCF7e` ([BaseScan](https://sepolia.basescan.org/address/0x036cbd53842c5426634e7929541ec2318f3dcf7e))
- Companion SDK: [`elsax402-sessions`](../x402-session-sdk)
- x402 protocol: https://x402.org
