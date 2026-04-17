// Environment status check: facilitator health + all account balances on Base Sepolia.

import "dotenv/config";
import { formatEther, type Address } from "viem";
import { makePublicClient, readBalanceOf } from "elsax402-sessions";

const FACILITATOR_URL = process.env.FACILITATOR_URL ?? "http://localhost:4021";
const NETWORK = (process.env.NETWORK ?? "base:sepolia") as "base:sepolia";
const USDC_ADDRESS = (process.env.USDC_ADDRESS ??
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e") as Address;
const DECIMALS = 6;

const publicClient = makePublicClient(NETWORK);

function formatUsdc(baseUnits: bigint): string {
  const whole = baseUnits / 10n ** BigInt(DECIMALS);
  const frac = baseUnits % 10n ** BigInt(DECIMALS);
  return `${whole}.${frac.toString().padStart(DECIMALS, "0")}`;
}

async function balances(address: Address): Promise<{ eth: string; usdc: string }> {
  try {
    const [wei, usdcBase] = await Promise.all([
      publicClient.getBalance({ address }),
      readBalanceOf(publicClient, USDC_ADDRESS, address),
    ]);
    return { eth: formatEther(wei), usdc: formatUsdc(usdcBase) };
  } catch (e) {
    return { eth: `ERR: ${(e as Error).message}`, usdc: "—" };
  }
}

function row(label: string, address: string, eth: string, usdc: string) {
  const short = `${address.slice(0, 8)}…${address.slice(-6)}`;
  console.log(
    `  ${label.padEnd(12)} ${short}   ${eth.padStart(18)} ETH   ${usdc.padStart(18)} USDC`,
  );
}

async function main() {
  console.log("━━━ elsax402-sessions environment status ━━━\n");

  // Facilitator
  let facilitatorAddress: Address | undefined;
  try {
    const res = await fetch(`${FACILITATOR_URL}/health`);
    const j = (await res.json()) as {
      ok: boolean;
      address: string;
      network?: string;
      chainId?: number;
    };
    console.log(`facilitator  ${FACILITATOR_URL}   ✓ ok`);
    console.log(`             network=${j.network ?? "?"}  chainId=${j.chainId ?? "?"}`);
    facilitatorAddress = j.address as Address;
  } catch (e) {
    console.log(`facilitator  ${FACILITATOR_URL}`);
    console.log(`  ✗ unreachable: ${(e as Error).message}`);
    console.log(`  start:     cd ../x402-session-facilitator && npm run dev`);
  }

  console.log();

  if (facilitatorAddress) {
    const b = await balances(facilitatorAddress);
    row("facilitator", facilitatorAddress, b.eth, b.usdc);
  }
  if (process.env.USER_ADDRESS) {
    const addr = process.env.USER_ADDRESS as Address;
    const b = await balances(addr);
    row("user", addr, b.eth, b.usdc);
  }
  if (process.env.RECIPIENT_ADDRESS) {
    const addr = process.env.RECIPIENT_ADDRESS as Address;
    const b = await balances(addr);
    row("recipient", addr, b.eth, b.usdc);
  }

  console.log(`\nUSDC contract: ${USDC_ADDRESS}`);
  console.log(`Network:       ${NETWORK}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
