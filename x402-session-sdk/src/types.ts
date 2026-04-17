// Types shared between client SDK, resource-server scheme plugin, and facilitator.
// These mirror the wire format defined in the facilitator package.

import type { Address, Hex, PublicClient, WalletClient } from "viem";

/**
 * Network identifier. Accepts both human-readable ("base:sepolia") and
 * CAIP-2 ("eip155:84532") forms. The facilitator advertises both.
 */
export type Network =
  | "base:sepolia"
  | "base:mainnet"
  | "eip155:84532"
  | "eip155:8453"
  | `${string}:${string}`;

export type PaymentRequirements = {
  scheme: string;
  network: Network;
  asset: string;
  amount: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: Record<string, unknown>;
};

export type SessionPaymentPayloadBody = {
  sessionId: string;
};

export type PaymentPayload = {
  x402Version: number;
  accepted: PaymentRequirements;
  payload: SessionPaymentPayloadBody;
  resource?: { url: string; description?: string; mimeType?: string };
  extensions?: Record<string, unknown>;
};

export type PaymentRequired = {
  x402Version: number;
  error?: string;
  resource: { url: string; description?: string; mimeType?: string };
  accepts: PaymentRequirements[];
  extensions?: Record<string, unknown>;
};

// --------------------------------------------------------------------------
// Session types
// --------------------------------------------------------------------------

export type CreateSessionOptions = {
  /** Facilitator HTTP base URL, e.g. http://localhost:4021 */
  facilitatorUrl: string;
  /** Network identifier. Default: "base:sepolia" */
  network?: Network;
  /** ERC20 token contract address (e.g. USDC on Base Sepolia). */
  asset: Address;
  /**
   * Spending cap in human units (e.g. "1.00" for 1 USDC).
   * Will be converted to base units using `decimals`.
   */
  spendingCap: string;
  /** Token decimals. USDC on Base = 6. Default: 6 */
  decimals?: number;
  /** How long the session is valid, in seconds. Stored as unix-ts on the facilitator. */
  expiresIn: number;
  /** Address where settled funds go (resource server wallet). */
  recipient: Address;
  /**
   * Wallet client used to sign & submit the ERC20 approve transaction.
   * On Node: build via `walletClientFromPrivateKey()` from "elsax402-sessions/evm".
   * In the browser: pass the result of wagmi's `useWalletClient()`.
   */
  walletClient: WalletClient;
  /**
   * Optional public client for read-only RPC calls (allowance, receipts).
   * If omitted, one is created from `network` + `rpcUrl`.
   */
  publicClient?: PublicClient;
  /** Optional custom EVM RPC URL. Defaults to viem's chain default. */
  rpcUrl?: string;
};

/**
 * Minimal signer interface kept for backward compatibility / convenience.
 * In the EVM port we standardize on viem's WalletClient (see CreateSessionOptions).
 */
export interface ClientSigner {
  /** The 0x... address of this signer. */
  publicKey(): Address;
}

export type SessionHandle = {
  sessionId: string;
  user: Address;
  spender: Address;
  asset: Address;
  recipient: Address;
  cap: string;
  spent: string;
  expiresAt: number; // unix seconds
  network: Network;
  facilitatorUrl: string;
  /** Fetch wrapper that auto-adds PAYMENT-SIGNATURE session header on 402 responses. */
  fetch: typeof fetch;
};

// --------------------------------------------------------------------------
// Facilitator /sessions wire shapes
// --------------------------------------------------------------------------

export type CreateSessionRequest = {
  approvalTxHash: Hex;
  user: Address;
  asset: Address;
  recipient: Address;
  cap: string;
  expiresAt: number;
  network: Network;
};

export type CreateSessionResponse = {
  sessionId: string;
  user: Address;
  spender: Address;
  asset: Address;
  recipient: Address;
  cap: string;
  spent: string;
  expiresAt: number;
  network: Network;
};

export type SupportedResponse = {
  kinds: Array<{
    x402Version: number;
    scheme: string;
    network: Network;
    extra?: Record<string, unknown>;
  }>;
  extensions: string[];
  signers: Record<string, string[]>;
};
