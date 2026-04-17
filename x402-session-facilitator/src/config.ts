import "dotenv/config";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import type { Network } from "./types";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

const facilitatorPrivateKey = required("FACILITATOR_PRIVATE_KEY") as Hex;
export const facilitatorAccount = privateKeyToAccount(facilitatorPrivateKey);

export const config = {
  port: Number(process.env.PORT ?? 4021),
  network: (process.env.NETWORK ?? "base:sepolia") as Network,
  // CAIP-2 form advertised alongside the human-readable form.
  networkCaip: (process.env.NETWORK_CAIP ?? "eip155:84532") as Network,
  rpcUrl: process.env.BASE_RPC_URL ?? "https://sepolia.base.org",
  chainId: Number(process.env.CHAIN_ID ?? 84532),
  usdcAddress: (process.env.USDC_CONTRACT_ADDRESS ??
    "0x036CbD53842c5426634e7929541eC2318f3dCF7e") as Address,
  assetDecimals: Number(process.env.ASSET_DECIMALS ?? 6),
  maxPerCallDecimal: Number(process.env.MAX_PER_CALL ?? 1.0),
  dbPath: process.env.DB_PATH ?? "./sessions.db",
  facilitatorPrivateKey,
  facilitatorAccount,
};

export const facilitatorAddress: Address = facilitatorAccount.address;

// Convert MAX_PER_CALL (decimal, e.g. 1.00) to base-unit bigint.
export const maxPerCallBaseUnits: bigint = BigInt(
  Math.round(config.maxPerCallDecimal * 10 ** config.assetDecimals),
);
