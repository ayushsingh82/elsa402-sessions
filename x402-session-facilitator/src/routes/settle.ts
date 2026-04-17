import type { Request, Response } from "express";
import type { Address } from "viem";
import { config } from "../config";
import { debitSession, getSession, refundSession } from "../storage";
import { getNowSeconds, transferFrom } from "../evm";
import { verify } from "./verify";
import type {
  PaymentPayload,
  PaymentRequirements,
  SessionPaymentPayloadBody,
  SettleRequest,
  SettleResponse,
} from "../types";

/**
 * POST /settle
 *
 * Re-runs verify(), then:
 *   1. Debits the session in sqlite (atomic; cap + expiry enforced).
 *   2. Executes ERC20 transferFrom on-chain (facilitator as spender).
 *   3. On on-chain failure, refunds the sqlite debit so the session isn't drained.
 */
export async function settleHandler(req: Request, res: Response) {
  const body = req.body as Partial<SettleRequest>;
  const payload = body.paymentPayload;
  const requirements = body.paymentRequirements;

  if (!payload || !requirements) {
    return res.status(400).json({ error: "missing paymentPayload or paymentRequirements" });
  }

  const result = await settle(payload, requirements);
  return res.status(result.success ? 200 : 400).json(result);
}

export async function settle(
  payload: PaymentPayload,
  requirements: PaymentRequirements,
): Promise<SettleResponse> {
  // 1. Re-verify — /settle MUST re-run verify per x402 spec.
  const verifyResult = await verify(payload, requirements);
  if (!verifyResult.isValid) {
    return {
      success: false,
      errorReason: verifyResult.invalidReason ?? "verify_failed",
      errorMessage: verifyResult.invalidMessage,
      transaction: "",
      network: config.network,
    };
  }

  const sessionBody = payload.payload as SessionPaymentPayloadBody;
  const session = getSession(sessionBody.sessionId);
  if (!session) {
    return {
      success: false,
      errorReason: "session_not_found",
      transaction: "",
      network: config.network,
    };
  }

  const amount = BigInt(requirements.amount);

  // 2. Debit session FIRST (in a transaction with cap+expiry check).
  let debited;
  try {
    debited = debitSession(sessionBody.sessionId, amount, getNowSeconds());
  } catch (err) {
    return {
      success: false,
      errorReason: "debit_failed",
      errorMessage: err instanceof Error ? err.message : String(err),
      transaction: "",
      network: config.network,
    };
  }

  // 3. Execute the on-chain transferFrom.
  try {
    const { txHash } = await transferFrom({
      asset: session.asset as Address,
      from: session.user as Address,
      to: session.recipient as Address,
      amount,
    });
    return {
      success: true,
      payer: session.user,
      transaction: txHash,
      network: config.network,
      extensions: {
        session: {
          id: debited.id,
          cap: debited.cap,
          spent: debited.spent,
          remaining: (BigInt(debited.cap) - BigInt(debited.spent)).toString(),
        },
      },
    };
  } catch (err) {
    // On-chain failed — roll back the sqlite debit so the session isn't
    // wrongly drained.
    console.error(
      `[settle] on-chain transferFrom FAILED; rolling back debit for session=${sessionBody.sessionId}`,
      err,
    );
    try {
      refundSession(sessionBody.sessionId, amount);
    } catch (refundErr) {
      console.error(
        `[settle] CRITICAL: refund failed after on-chain failure; session=${sessionBody.sessionId}`,
        refundErr,
      );
    }
    return {
      success: false,
      errorReason: "onchain_transfer_failed",
      errorMessage: err instanceof Error ? err.message : String(err),
      transaction: "",
      network: config.network,
    };
  }
}
