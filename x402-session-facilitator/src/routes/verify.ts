import type { Request, Response } from "express";
import { config, facilitatorAddress, maxPerCallBaseUnits } from "../config";
import { getSession } from "../storage";
import { getNowSeconds } from "../evm";
import type {
  PaymentPayload,
  PaymentRequirements,
  SessionPaymentPayloadBody,
  VerifyRequest,
  VerifyResponse,
} from "../types";

function networkMatches(a: string, b: string): boolean {
  if (a === b) return true;
  const aliases: Record<string, string[]> = {
    "base:sepolia": ["eip155:84532"],
    "base:mainnet": ["eip155:8453"],
    "eip155:84532": ["base:sepolia"],
    "eip155:8453": ["base:mainnet"],
  };
  return aliases[a]?.includes(b) ?? false;
}

function addressMatches(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * POST /verify
 *
 * Stateless check that the session referenced in paymentPayload.payload.sessionId:
 *   - exists
 *   - matches the requirements (asset, network, payTo)
 *   - is not expired
 *   - has headroom for the requested amount
 *   - the per-call amount is within our policy limit
 *
 * Does NOT submit anything on-chain. Does NOT debit the session.
 */
export async function verifyHandler(req: Request, res: Response) {
  const body = req.body as Partial<VerifyRequest>;
  const payload = body.paymentPayload;
  const requirements = body.paymentRequirements;

  if (!payload || !requirements) {
    return res.status(400).json({ error: "missing paymentPayload or paymentRequirements" });
  }

  const result = await verify(payload, requirements);
  return res.json(result);
}

export async function verify(
  payload: PaymentPayload,
  requirements: PaymentRequirements,
): Promise<VerifyResponse> {
  const invalid = (reason: string, message?: string): VerifyResponse => ({
    isValid: false,
    invalidReason: reason,
    invalidMessage: message ?? reason,
  });

  if (requirements.scheme !== "session") return invalid("scheme_mismatch");
  if (!networkMatches(requirements.network, config.network)) return invalid("network_mismatch");

  const sessionBody = payload.payload as SessionPaymentPayloadBody;
  if (!sessionBody || typeof sessionBody.sessionId !== "string") {
    return invalid("missing_session_id", "paymentPayload.payload.sessionId is required");
  }

  const session = getSession(sessionBody.sessionId);
  if (!session) return invalid("session_not_found", sessionBody.sessionId);

  if (!addressMatches(session.asset, requirements.asset)) {
    return invalid(
      "asset_mismatch",
      `session.asset=${session.asset} requirements.asset=${requirements.asset}`,
    );
  }
  if (!addressMatches(session.recipient, requirements.payTo)) {
    return invalid(
      "recipient_mismatch",
      `session.recipient=${session.recipient} requirements.payTo=${requirements.payTo}`,
    );
  }
  if (!addressMatches(session.spender, facilitatorAddress)) {
    return invalid("spender_mismatch");
  }
  if (!networkMatches(session.network, requirements.network)) {
    return invalid("session_network_mismatch");
  }

  // Expiry check (unix-ts).
  const now = getNowSeconds();
  if (session.expiresAt <= now) {
    return invalid("session_expired");
  }

  // Per-call policy limit.
  const amount = BigInt(requirements.amount);
  if (amount <= 0n) return invalid("invalid_amount");
  if (amount > maxPerCallBaseUnits) {
    return invalid(
      "per_call_limit_exceeded",
      `amount ${amount} exceeds facilitator per-call policy ${maxPerCallBaseUnits}`,
    );
  }

  // Cap headroom.
  const cap = BigInt(session.cap);
  const spent = BigInt(session.spent);
  if (spent + amount > cap) {
    return invalid(
      "cap_exceeded",
      `cap=${cap} spent=${spent} requested=${amount}`,
    );
  }

  return { isValid: true, payer: session.user };
}
