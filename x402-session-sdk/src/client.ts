// createSession() — the main client-facing API.
//
// Flow (Base Sepolia EVM port of the Stellar session model):
//   1. GET {facilitatorUrl}/supported to learn the facilitator's spender address.
//   2. Sign & submit ERC20 approve(spender, cap) on-chain.
//   3. POST /sessions to register the approval. Returns a sessionId.
//   4. Return a SessionHandle with a wrapFetch() that auto-handles 402 responses.

import type { Address } from "viem";
import {
  approveERC20,
  decimalToBaseUnits,
  defaultRpcUrlFor,
  getNowSeconds,
  makePublicClient,
  DEFAULT_DECIMALS,
} from "./evm";
import type {
  CreateSessionOptions,
  CreateSessionRequest,
  CreateSessionResponse,
  PaymentPayload,
  PaymentRequired,
  PaymentRequirements,
  SessionHandle,
  SupportedResponse,
  Network,
} from "./types";

const DEFAULT_NETWORK: Network = "base:sepolia";

export async function createSession(opts: CreateSessionOptions): Promise<SessionHandle> {
  const network = opts.network ?? DEFAULT_NETWORK;
  const decimals = opts.decimals ?? DEFAULT_DECIMALS;
  const rpcUrl = opts.rpcUrl ?? defaultRpcUrlFor(network);

  const account = opts.walletClient.account;
  if (!account) throw new Error("walletClient must have an account attached");
  const user = account.address as Address;

  const publicClient = opts.publicClient ?? makePublicClient(network, rpcUrl);

  // 1. Fetch facilitator's /supported to discover spender address.
  const supported = await fetchSupported(opts.facilitatorUrl);
  const kind = supported.kinds.find(
    (k) => k.scheme === "session" && networkMatches(k.network, network),
  );
  if (!kind) {
    throw new Error(
      `facilitator ${opts.facilitatorUrl} does not advertise scheme=session network=${network}`,
    );
  }
  const spender = ((kind.extra?.spender as string) ??
    supported.signers["evm:*"]?.[0] ??
    supported.signers["eip155:*"]?.[0]) as Address | undefined;
  if (!spender) {
    throw new Error(
      `facilitator /supported did not include a spender address; got: ${JSON.stringify(supported)}`,
    );
  }

  // 2. Compute expiresAt unix-ts from expiresIn seconds.
  const expiresAt = getNowSeconds() + opts.expiresIn;

  // 3. Sign & submit ERC20 approve on-chain.
  const capBaseUnits = decimalToBaseUnits(opts.spendingCap, decimals);
  const { txHash } = await approveERC20({
    walletClient: opts.walletClient,
    publicClient,
    asset: opts.asset,
    spender,
    amount: capBaseUnits,
  });

  // 4. Register the session with the facilitator.
  const createReq: CreateSessionRequest = {
    approvalTxHash: txHash,
    user,
    asset: opts.asset,
    recipient: opts.recipient,
    cap: capBaseUnits.toString(),
    expiresAt,
    network,
  };
  const created = await postSession(opts.facilitatorUrl, createReq);

  // 5. Build the session handle with wrapped fetch.
  return {
    sessionId: created.sessionId,
    user: created.user,
    spender: created.spender,
    asset: created.asset,
    recipient: created.recipient,
    cap: created.cap,
    spent: created.spent,
    expiresAt: created.expiresAt,
    network: created.network,
    facilitatorUrl: opts.facilitatorUrl,
    fetch: wrapFetch(created.sessionId),
  };
}

function networkMatches(a: Network, b: Network): boolean {
  if (a === b) return true;
  // Treat the human and CAIP-2 forms of Base as equivalent.
  const aliases: Record<string, string[]> = {
    "base:sepolia": ["eip155:84532"],
    "base:mainnet": ["eip155:8453"],
    "eip155:84532": ["base:sepolia"],
    "eip155:8453": ["base:mainnet"],
  };
  return aliases[a as string]?.includes(b as string) ?? false;
}

async function fetchSupported(facilitatorUrl: string): Promise<SupportedResponse> {
  const res = await fetch(joinUrl(facilitatorUrl, "/supported"));
  if (!res.ok) throw new Error(`facilitator /supported returned ${res.status}`);
  return (await res.json()) as SupportedResponse;
}

async function postSession(
  facilitatorUrl: string,
  body: CreateSessionRequest,
): Promise<CreateSessionResponse> {
  const res = await fetch(joinUrl(facilitatorUrl, "/sessions"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`facilitator /sessions ${res.status}: ${text}`);
  }
  return (await res.json()) as CreateSessionResponse;
}

function joinUrl(base: string, path: string): string {
  return base.replace(/\/+$/, "") + (path.startsWith("/") ? path : `/${path}`);
}

// --------------------------------------------------------------------------
// wrapFetch: automatically handles 402 responses by attaching the session payload
// --------------------------------------------------------------------------

/**
 * Returns a fetch-compatible function that, on a 402 response, decodes the
 * `PAYMENT-REQUIRED` response header (x402 v2), finds a `scheme: "session"`
 * accept entry, and retries with `PAYMENT-SIGNATURE` (plus `X-PAYMENT` as a
 * fallback for older servers).
 */
export function wrapFetch(sessionId: string): typeof fetch {
  return async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const first = await fetch(input, init);
    if (first.status !== 402) return first;

    let required: PaymentRequired | null = null;

    const headerValue =
      first.headers.get("payment-required") ??
      first.headers.get("PAYMENT-REQUIRED") ??
      first.headers.get("x-payment-required");
    if (headerValue) {
      try {
        required = base64DecodeJson<PaymentRequired>(headerValue);
      } catch {
        /* fall through */
      }
    }

    if (!required) {
      try {
        const body = (await first.clone().json()) as Partial<PaymentRequired>;
        if (body && Array.isArray(body.accepts)) required = body as PaymentRequired;
      } catch {
        /* fall through */
      }
    }

    if (!required) return first;

    const sessionAccept = (required.accepts ?? []).find(
      (a: PaymentRequirements) => a.scheme === "session",
    );
    if (!sessionAccept) return first;

    const paymentPayload: PaymentPayload = {
      x402Version: required.x402Version ?? 2,
      accepted: sessionAccept,
      payload: { sessionId },
    };

    const encoded = base64EncodeJson(paymentPayload);
    const retryInit: RequestInit = {
      ...init,
      headers: {
        ...(init.headers as Record<string, string> | undefined),
        "PAYMENT-SIGNATURE": encoded,
        "X-PAYMENT": encoded,
      },
    };
    return fetch(input, retryInit);
  };
}

function base64EncodeJson(obj: unknown): string {
  const json = JSON.stringify(obj);
  if (typeof Buffer !== "undefined") return Buffer.from(json, "utf-8").toString("base64");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g: any = globalThis;
  return g.btoa(unescape(encodeURIComponent(json)));
}

function base64DecodeJson<T>(b64: string): T {
  let json: string;
  if (typeof Buffer !== "undefined") {
    json = Buffer.from(b64, "base64").toString("utf-8");
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g: any = globalThis;
    json = decodeURIComponent(escape(g.atob(b64)));
  }
  return JSON.parse(json) as T;
}
