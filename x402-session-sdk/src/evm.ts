// Client-side EVM helpers for the SDK:
//  - build & submit ERC20 `approve(spender, amount)`
//  - read `allowance(owner, spender)` / `balanceOf(owner)`
//  - chain + RPC config
//
// Imports viem as a peer dep — users bring their own version.

import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Chain,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { base, baseSepolia } from "viem/chains";
import type { Network } from "./types";

export const USDC_BASE_SEPOLIA: Address = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
export const USDC_BASE_MAINNET: Address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// USDC on Base / Base Sepolia uses 6 decimals (Circle FiatTokenProxy v2).
export const DEFAULT_DECIMALS = 6;

export const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "transferFrom",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

/**
 * Map network identifiers to viem `Chain` objects.
 * Accepts both human-readable form ("base:sepolia") and CAIP-2 form ("eip155:84532").
 */
export function chainFor(network: Network): Chain {
  switch (network) {
    case "base:mainnet":
    case "eip155:8453":
      return base;
    case "base:sepolia":
    case "eip155:84532":
      return baseSepolia;
    default:
      throw new Error(`Unsupported network: ${network}`);
  }
}

export function defaultRpcUrlFor(network: Network): string {
  const c = chainFor(network);
  return c.rpcUrls.default.http[0];
}

/**
 * Default USDC contract address for a given network.
 */
export function defaultUsdcFor(network: Network): Address {
  const c = chainFor(network);
  if (c.id === base.id) return USDC_BASE_MAINNET;
  if (c.id === baseSepolia.id) return USDC_BASE_SEPOLIA;
  throw new Error(`No default USDC address for chain id ${c.id}`);
}

/**
 * Convert a decimal-string amount (e.g. "1.00") to base-unit bigint given decimals.
 * Supports simple decimal form only; rejects scientific notation.
 */
export function decimalToBaseUnits(amount: string | number, decimals = DEFAULT_DECIMALS): bigint {
  const s = typeof amount === "number" ? amount.toString() : amount;
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error(`invalid decimal amount: ${s}`);
  const [whole, frac = ""] = s.split(".");
  const padded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(padded || "0");
}

/**
 * Build a fresh PublicClient for the given network and optional RPC URL.
 */
export function makePublicClient(network: Network, rpcUrl?: string): PublicClient {
  const chain = chainFor(network);
  return createPublicClient({
    chain,
    transport: http(rpcUrl ?? defaultRpcUrlFor(network)),
  });
}

/**
 * Quick helper for Node-side signers: build a WalletClient from a private key.
 * Browsers should use wagmi's `useWalletClient()` and pass that in directly.
 */
export async function walletClientFromPrivateKey(
  privateKey: Hex,
  network: Network,
  rpcUrl?: string,
): Promise<WalletClient> {
  // Lazy import so browser bundles don't pull in `viem/accounts` unless needed.
  const { privateKeyToAccount } = await import("viem/accounts");
  const account = privateKeyToAccount(privateKey);
  return createWalletClient({
    account,
    chain: chainFor(network),
    transport: http(rpcUrl ?? defaultRpcUrlFor(network)),
  });
}

/**
 * Submit `approve(spender, amount)` on the given ERC20 and wait for confirmation.
 * Returns the tx hash on success.
 */
export async function approveERC20(args: {
  walletClient: WalletClient;
  publicClient: PublicClient;
  asset: Address;
  spender: Address;
  amount: bigint;
}): Promise<{ txHash: Hex }> {
  const account = args.walletClient.account;
  if (!account) throw new Error("walletClient has no account attached");

  const txHash = await args.walletClient.writeContract({
    account,
    chain: args.walletClient.chain,
    address: args.asset,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [args.spender, args.amount],
  });

  const receipt = await args.publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") {
    throw new Error(`approve tx ${txHash} reverted`);
  }
  return { txHash };
}

export async function readAllowance(
  publicClient: PublicClient,
  asset: Address,
  owner: Address,
  spender: Address,
): Promise<bigint> {
  return (await publicClient.readContract({
    address: asset,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [owner, spender],
  })) as bigint;
}

export async function readBalanceOf(
  publicClient: PublicClient,
  asset: Address,
  owner: Address,
): Promise<bigint> {
  return (await publicClient.readContract({
    address: asset,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [owner],
  })) as bigint;
}

export function getNowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}
