// SessionEvmScheme — resource-server plugin for the `session` scheme on EVM (Base).
//
// Implements (structurally) @x402/core's SchemeNetworkServer interface so it can
// be registered with `x402ResourceServer.register(network, new SessionEvmScheme())`.
//
// Responsibilities:
//   - parsePrice(): convert "0.10" (decimal USDC) to { asset, amount } base units.
//   - enhancePaymentRequirements(): add scheme-specific extras (facilitator spender,
//     sessions endpoint URL) to the 402 response so the client SDK knows where to
//     create a session.
//
// The actual verify/settle happen on the HTTP facilitator (our Express service),
// which x402's HTTPFacilitatorClient talks to.

import type { Network, PaymentRequirements } from "./types";

type AssetAmount = { asset: string; amount: string; extra?: Record<string, unknown> };
type Price = string | number | AssetAmount;

export type SessionSchemeConfig = {
  /** ERC20 contract address of the payment token (e.g. USDC on Base Sepolia). */
  assetAddress: string;
  /** Token decimals. Default 6 (USDC on Base). */
  decimals?: number;
  /** Facilitator base URL — embedded into /402 extras so clients can find the sessions endpoint. */
  facilitatorUrl?: string;
};

const DEFAULT_DECIMALS = 6;

function decimalToBaseUnits(amount: string | number, decimals: number): string {
  const s = typeof amount === "number" ? amount.toString() : amount;
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error(`invalid decimal amount: ${s}`);
  const [whole, frac = ""] = s.split(".");
  const padded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return (BigInt(whole) * 10n ** BigInt(decimals) + BigInt(padded || "0")).toString();
}

/**
 * Resource-server plugin for the `session` scheme on EVM (Base).
 *
 * Usage (in your proxy.ts):
 *
 *   import { SessionEvmScheme } from "elsax402-sessions/scheme";
 *
 *   const server = new x402ResourceServer(facilitatorClient)
 *     .register("base:sepolia", new SessionEvmScheme({
 *       assetAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
 *       facilitatorUrl: "http://localhost:4021",
 *     }));
 */
export class SessionEvmScheme {
  readonly scheme = "session" as const;
  private readonly config: Required<Pick<SessionSchemeConfig, "decimals">> & SessionSchemeConfig;

  constructor(config: SessionSchemeConfig) {
    this.config = { decimals: DEFAULT_DECIMALS, ...config };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async parsePrice(price: Price, _network: Network): Promise<AssetAmount> {
    if (typeof price === "object" && "asset" in price && "amount" in price) {
      return price;
    }
    const amount = decimalToBaseUnits(price as string | number, this.config.decimals);
    return { asset: this.config.assetAddress, amount };
  }

  async enhancePaymentRequirements(
    paymentRequirements: PaymentRequirements,
    supportedKind: {
      x402Version: number;
      scheme: string;
      network: Network;
      extra?: Record<string, unknown>;
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _facilitatorExtensions: string[],
  ): Promise<PaymentRequirements> {
    const mergedExtra: Record<string, unknown> = {
      ...paymentRequirements.extra,
      ...(supportedKind.extra ?? {}),
    };
    if (this.config.facilitatorUrl && !mergedExtra.facilitatorUrl) {
      mergedExtra.facilitatorUrl = this.config.facilitatorUrl;
    }
    return { ...paymentRequirements, extra: mergedExtra };
  }
}

// Backwards-compatible alias for code paths that still reference the Stellar name.
export { SessionEvmScheme as SessionStellarScheme };
