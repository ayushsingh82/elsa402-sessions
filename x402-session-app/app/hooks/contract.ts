"use client";

// Base / Base Sepolia constants used by client-side code.

export const NETWORK = "base:sepolia" as const;

export const CHAIN_ID = NETWORK === "base:mainnet" ? 8453 : 84532;

export const BASE_RPC_URL =
  process.env.NEXT_PUBLIC_BASE_RPC_URL ??
  (NETWORK === "base:mainnet" ? "https://mainnet.base.org" : "https://sepolia.base.org");

export const EXPLORER_URL =
  NETWORK === "base:mainnet"
    ? "https://basescan.org"
    : "https://sepolia.basescan.org";

export const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS ??
  (NETWORK === "base:mainnet"
    ? "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
    : "0x036CbD53842c5426634e7929541eC2318f3dCF7e")) as `0x${string}`;

export function txExplorerUrl(hash: string): string {
  return `${EXPLORER_URL}/tx/${hash}`;
}

export function addressExplorerUrl(addr: string): string {
  return `${EXPLORER_URL}/address/${addr}`;
}
