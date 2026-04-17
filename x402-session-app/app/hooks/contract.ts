"use client";

// Base / Base Sepolia constants used by client-side code.

export const NETWORK = "base:sepolia" as const;

export const CHAIN_ID = 84532;

export const BASE_RPC_URL = "https://sepolia.base.org";

export const EXPLORER_URL = "https://sepolia.basescan.org";

export const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS ??
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e") as `0x${string}`;

export function txExplorerUrl(hash: string): string {
  return `${EXPLORER_URL}/tx/${hash}`;
}

export function addressExplorerUrl(addr: string): string {
  return `${EXPLORER_URL}/address/${addr}`;
}
