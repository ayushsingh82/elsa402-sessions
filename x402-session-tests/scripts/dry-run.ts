// Full end-to-end dry-run of elsax402-sessions + facilitator on Base Sepolia.
//
// Uses USER_PRIVATE_KEY from .env and canonical Circle USDC on Base Sepolia.
//
// Flow:
//   1. createSession — signs ERC20 approve(user, facilitator, 10 USDC) on-chain
//      and registers the session with the facilitator.
//   2. Loop /settle three times — each call debits the session + executes
//      ERC20 transferFrom(user, recipient, 0.5 USDC) on-chain.
//   3. Verify: fetch final session state, read recipient USDC balance delta.
//
// Prereq: facilitator must be running.  cd ../x402-session-facilitator && npm run dev

import "dotenv/config";
import type { Address, Hex } from "viem";
import {
  createSession,
  makePublicClient,
  readBalanceOf,
  walletClientFromPrivateKey,
} from "elsax402-sessions";
import type { PaymentPayload, PaymentRequirements } from "elsax402-sessions";

const FACILITATOR_URL = process.env.FACILITATOR_URL ?? "http://localhost:4021";
const USER_PRIVATE_KEY = required("USER_PRIVATE_KEY") as Hex;
const RECIPIENT_ADDRESS = required("RECIPIENT_ADDRESS") as Address;
const USDC_ADDRESS = required("USDC_ADDRESS") as Address;

const NETWORK = "base:sepolia" as const;
const CAP_USDC = "10.00";
const PER_CALL_USDC = "0.5";
const PER_CALL_BASE_UNITS = "500000"; // 0.5 USDC at 6 decimals
const CALLS = 3;
const DECIMALS = 6;

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env var ${name}. Run: npm run gen`);
    process.exit(1);
  }
  return v;
}

function formatUsdc(baseUnits: bigint | string): string {
  const n = typeof baseUnits === "bigint" ? baseUnits : BigInt(baseUnits);
  const whole = n / 10n ** BigInt(DECIMALS);
  const frac = n % 10n ** BigInt(DECIMALS);
  return `${whole}.${frac.toString().padStart(DECIMALS, "0")}`;
}

async function main() {
  const walletClient = await walletClientFromPrivateKey(USER_PRIVATE_KEY, NETWORK);
  const publicClient = makePublicClient(NETWORK);
  const userAddress = walletClient.account!.address as Address;

  console.log("━━━ elsax402-sessions dry-run ━━━");
  console.log(`  facilitator: ${FACILITATOR_URL}`);
  console.log(`  network:     ${NETWORK}`);
  console.log(`  user:        ${userAddress}`);
  console.log(`  recipient:   ${RECIPIENT_ADDRESS}`);
  console.log(`  asset:       ${USDC_ADDRESS}  (Circle USDC on Base Sepolia)`);
  console.log(`  cap:         ${CAP_USDC} USDC`);
  console.log(`  per call:    ${PER_CALL_USDC} USDC × ${CALLS}`);
  console.log();

  // Sanity: facilitator reachable?
  try {
    const h = await fetch(`${FACILITATOR_URL}/health`);
    if (!h.ok) throw new Error(`status ${h.status}`);
    console.log("✓ facilitator reachable\n");
  } catch (e) {
    console.error(`Cannot reach facilitator at ${FACILITATOR_URL}: ${(e as Error).message}`);
    console.error(
      "Start it in another terminal:  cd ../x402-session-facilitator && npm run dev",
    );
    process.exit(1);
  }

  const userBefore = await readBalanceOf(publicClient, USDC_ADDRESS, userAddress);
  const recipientBefore = await readBalanceOf(publicClient, USDC_ADDRESS, RECIPIENT_ADDRESS);
  console.log(`user USDC before:      ${formatUsdc(userBefore)}`);
  console.log(`recipient USDC before: ${formatUsdc(recipientBefore)}\n`);

  // ─── 1. createSession ─────────────────────────────────────────────
  console.log("[1] createSession — signing ERC20 approve on-chain...");
  const session = await createSession({
    walletClient,
    facilitatorUrl: FACILITATOR_URL,
    network: NETWORK,
    asset: USDC_ADDRESS,
    spendingCap: CAP_USDC,
    decimals: DECIMALS,
    expiresIn: 3600,
    recipient: RECIPIENT_ADDRESS,
  });
  console.log(`    ✓ session: ${session.sessionId}`);
  console.log(`      spender:  ${session.spender}`);
  console.log(`      cap:      ${session.cap} base-units (${formatUsdc(session.cap)} USDC)`);
  console.log(`      spent:    ${session.spent} base-units`);
  console.log(
    `      expires:  ${session.expiresAt} (${new Date(session.expiresAt * 1000).toISOString()})\n`,
  );

  // ─── 2. Loop /settle ──────────────────────────────────────────────
  const requirements: PaymentRequirements = {
    scheme: "session",
    network: NETWORK,
    asset: USDC_ADDRESS,
    amount: PER_CALL_BASE_UNITS,
    payTo: RECIPIENT_ADDRESS,
    maxTimeoutSeconds: 60,
    extra: {},
  };
  const paymentPayload: PaymentPayload = {
    x402Version: 1,
    accepted: requirements,
    payload: { sessionId: session.sessionId },
  };

  for (let i = 1; i <= CALLS; i++) {
    console.log(`[settle ${i}] ${PER_CALL_USDC} USDC ...`);
    const res = await fetch(`${FACILITATOR_URL}/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        x402Version: 1,
        paymentPayload,
        paymentRequirements: requirements,
      }),
    });
    const body = (await res.json()) as {
      success: boolean;
      transaction?: string;
      errorReason?: string;
      errorMessage?: string;
      extensions?: { session?: { spent: string; remaining: string } };
    };
    if (body.success) {
      console.log(`    ✓ tx: ${body.transaction}`);
      if (body.transaction) {
        console.log(`      https://sepolia.basescan.org/tx/${body.transaction}`);
      }
      const rem = body.extensions?.session?.remaining;
      if (rem) {
        console.log(`      remaining: ${rem} base-units (${formatUsdc(rem)} USDC)`);
      }
    } else {
      console.error(`    ✗ ${body.errorReason}: ${body.errorMessage}`);
      process.exit(1);
    }
  }

  // ─── 3. Final state ───────────────────────────────────────────────
  console.log("\n[state] GET /sessions/:id");
  const stateRes = await fetch(`${FACILITATOR_URL}/sessions/${session.sessionId}`);
  const state = (await stateRes.json()) as {
    cap: string;
    spent: string;
    expiresAt: number;
  };
  const remaining = (BigInt(state.cap) - BigInt(state.spent)).toString();
  console.log(`    cap:       ${state.cap} base-units (${formatUsdc(state.cap)} USDC)`);
  console.log(`    spent:     ${state.spent} base-units (${formatUsdc(state.spent)} USDC)`);
  console.log(`    remaining: ${remaining} base-units (${formatUsdc(remaining)} USDC)`);
  console.log(`    expiresAt: ${state.expiresAt} (${new Date(state.expiresAt * 1000).toISOString()})`);

  // Assertions
  const expectedSpent = "1500000"; // 3 × 500000
  const expectedRemaining = "8500000"; // 10000000 - 1500000
  if (state.spent !== expectedSpent) {
    console.error(`\n✗ ASSERT FAILED: spent=${state.spent}, expected=${expectedSpent}`);
    process.exit(1);
  }
  if (remaining !== expectedRemaining) {
    console.error(`\n✗ ASSERT FAILED: remaining=${remaining}, expected=${expectedRemaining}`);
    process.exit(1);
  }
  console.log(`    ✓ assertions pass (spent=${expectedSpent}, remaining=${expectedRemaining})`);

  const userAfter = await readBalanceOf(publicClient, USDC_ADDRESS, userAddress);
  const recipientAfter = await readBalanceOf(publicClient, USDC_ADDRESS, RECIPIENT_ADDRESS);
  console.log(`\nuser USDC after:      ${formatUsdc(userAfter)}`);
  console.log(`recipient USDC after: ${formatUsdc(recipientAfter)}`);

  const deltaBaseUnits = recipientAfter - recipientBefore;
  const deltaHuman = Number(deltaBaseUnits) / 10 ** DECIMALS;
  const expectedDelta = Number(PER_CALL_USDC) * CALLS;
  console.log(
    `recipient delta: +${deltaHuman.toFixed(DECIMALS)} USDC  (expected +${expectedDelta.toFixed(DECIMALS)})`,
  );

  console.log("\n━━━ dry-run complete ✓ ━━━");
}

main().catch((err) => {
  console.error("\n✗ dry-run failed:");
  console.error(err);
  process.exit(1);
});
