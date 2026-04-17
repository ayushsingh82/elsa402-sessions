# elsax402-sessions end-to-end tests

Dry-run scripts that exercise the full pipeline: [`elsax402-sessions`](https://www.npmjs.com/package/elsax402-sessions) SDK → facilitator HTTP API → on-chain ERC20 `approve` + `transferFrom` on **Base Sepolia**.

Uses canonical **Circle USDC on Base Sepolia** (`0x036CbD53842c5426634e7929541eC2318f3dCF7e`, 6 decimals) as the payment asset.

**Default facilitator:** `https://elsax402-facilitator-production.up.railway.app`

The `npm run gen` script writes this URL into `.env`. You can override with `FACILITATOR_URL=...` to point at a local instance for offline iteration.

## Setup

```bash
# from this directory
npm install
```

## Run

**1. Generate user + recipient keypairs** (one-time):

```bash
npm run gen
```

Writes `.env` with `USER_PRIVATE_KEY`, `USER_ADDRESS`, `RECIPIENT_PRIVATE_KEY`, `RECIPIENT_ADDRESS`, `USDC_ADDRESS`, etc.

**2. Fund the user EOA** (manual — no programmatic faucet for USDC):

- ETH (for gas): https://www.alchemy.com/faucets/base-sepolia
- USDC: https://faucet.circle.com (select **Base Sepolia**)

Send both to the `USER_ADDRESS` printed by `npm run gen`. The recipient doesn't need funding.

**3. Facilitator** — by default the scripts hit the live Railway instance at
`https://elsax402-facilitator-production.up.railway.app`. To run your own locally instead, in a separate terminal:

```bash
cd ../x402-session-facilitator && npm run dev
# then set FACILITATOR_URL=http://localhost:4021 in .env
```

**4. (Optional) Check everything is ready:**

```bash
npm run status
```

Prints facilitator health (`/health`) plus ETH + USDC balances for the facilitator signer, user, and recipient.

**5. Run the dry-run:**

```bash
npm run dry-run
```

This will:

1. Call `createSession(...)` from the [`elsax402-sessions`](https://www.npmjs.com/package/elsax402-sessions) SDK. That signs & submits an on-chain ERC20 `approve(facilitator, 10 USDC)` transaction, then registers the session with the facilitator via `POST /sessions`.
2. Call `POST /settle` on the facilitator three times in a row with `amount = 500000` (0.5 USDC at 6 decimals). Each call:
   - Re-verifies the session in the facilitator (cap, expiry, recipient, per-call limit)
   - Debits the session in sqlite atomically
   - Executes `transferFrom(user, recipient, 0.5 USDC)` on-chain from the facilitator signer
3. Fetches final session state via `GET /sessions/:id`, asserts `spent == 1500000` and `remaining == 8500000`, then prints the recipient USDC balance delta observed on-chain (converted to human units).

### Expected output (success)

```
━━━ elsax402-sessions dry-run ━━━
  facilitator: https://elsax402-facilitator-production.up.railway.app
  network:     base:sepolia
  user:        0x...
  recipient:   0x...
  asset:       0x036CbD53842c5426634e7929541eC2318f3dCF7e  (Circle USDC on Base Sepolia)
  cap:         10.00 USDC
  per call:    0.5 USDC × 3

✓ facilitator reachable

user USDC before:      10.000000
recipient USDC before: 0.000000

[1] createSession — signing ERC20 approve on-chain...
    ✓ session: <uuid>
      spender:  0x...<facilitator>
      cap:      10000000 base-units (10.000000 USDC)
      spent:    0 base-units
      expires:  <unix-ts> (<ISO date>)

[settle 1] 0.5 USDC ...
    ✓ tx: 0x...
      https://sepolia.basescan.org/tx/0x...
      remaining: 9500000 base-units (9.500000 USDC)
[settle 2] 0.5 USDC ...
    ✓ tx: 0x...
      https://sepolia.basescan.org/tx/0x...
      remaining: 9000000 base-units (9.000000 USDC)
[settle 3] 0.5 USDC ...
    ✓ tx: 0x...
      https://sepolia.basescan.org/tx/0x...
      remaining: 8500000 base-units (8.500000 USDC)

[state] GET /sessions/:id
    cap:       10000000 base-units (10.000000 USDC)
    spent:     1500000 base-units (1.500000 USDC)
    remaining: 8500000 base-units (8.500000 USDC)
    expiresAt: <unix-ts> (<ISO date>)
    ✓ assertions pass (spent=1500000, remaining=8500000)

user USDC after:      8.500000
recipient USDC after: 1.500000
recipient delta: +1.500000 USDC  (expected +1.500000)

━━━ dry-run complete ✓ ━━━
```

## Scripts

| Script | Purpose |
|---|---|
| `npm run gen` | Generate user + recipient EOAs and write `.env` |
| `npm run status` | Check facilitator liveness + ETH/USDC balances for all known addresses |
| `npm run dry-run` | Full end-to-end flow: createSession + 3 settles + verify on-chain |
