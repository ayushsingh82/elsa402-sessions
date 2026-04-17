import type { Request, Response } from "express";
import type { Address, Hex } from "viem";
import { config, facilitatorAddress } from "../config";
import {
  assertApprovalTx,
  getNowSeconds,
  readAllowance,
} from "../evm";
import { createSession, getSession } from "../storage";
import type { CreateSessionRequest, CreateSessionResponse } from "../types";

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

/**
 * POST /sessions
 *
 * Client calls this after it has signed & submitted the ERC20 `approve` tx on-chain.
 * The facilitator:
 *   1. Confirms the approval tx exists, succeeded, and granted at least `cap` to us.
 *   2. Reads the current allowance(user, facilitator) on-chain (defense in depth).
 *   3. Verifies expiresAt is in the future.
 *   4. Persists the session record and returns a sessionId.
 */
export async function createSessionHandler(req: Request, res: Response) {
  const body = req.body as Partial<CreateSessionRequest>;

  const required: (keyof CreateSessionRequest)[] = [
    "approvalTxHash",
    "user",
    "asset",
    "recipient",
    "cap",
    "expiresAt",
    "network",
  ];
  for (const k of required) {
    if (body[k] === undefined || body[k] === null || body[k] === "") {
      return res.status(400).json({ error: `missing field: ${k}` });
    }
  }

  const input = body as CreateSessionRequest;

  if (!networkMatches(input.network, config.network)) {
    return res.status(400).json({
      error: `network mismatch: facilitator=${config.network} request=${input.network}`,
    });
  }

  try {
    const claimedCap = BigInt(input.cap);

    // 1. Confirm approve tx is valid & semantic content matches.
    await assertApprovalTx({
      txHash: input.approvalTxHash as Hex,
      expectedAsset: input.asset as Address,
      expectedSpender: facilitatorAddress,
      expectedFrom: input.user as Address,
      minValue: claimedCap,
    });

    // 2. Defense in depth: read live allowance.
    const onChainAllowance = await readAllowance(
      input.asset as Address,
      input.user as Address,
      facilitatorAddress,
    );
    if (onChainAllowance < claimedCap) {
      return res.status(400).json({
        error: `on-chain allowance ${onChainAllowance} is less than claimed cap ${claimedCap}`,
      });
    }

    // 3. expiresAt sanity.
    const now = getNowSeconds();
    if (input.expiresAt <= now) {
      return res.status(400).json({
        error: `expiresAt ${input.expiresAt} is in the past (now=${now})`,
      });
    }

    const record = createSession({
      user: input.user,
      spender: facilitatorAddress,
      asset: input.asset,
      recipient: input.recipient,
      cap: claimedCap.toString(),
      expiresAt: input.expiresAt,
      approvalTxHash: input.approvalTxHash,
      network: input.network,
    });

    const response: CreateSessionResponse = {
      sessionId: record.id,
      user: record.user,
      spender: record.spender,
      asset: record.asset,
      recipient: record.recipient,
      cap: record.cap,
      spent: record.spent,
      expiresAt: record.expiresAt,
      network: record.network,
    };
    return res.status(201).json(response);
  } catch (err) {
    return res.status(400).json({
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * GET /sessions/:id
 * Returns the current session state (cap, spent, expiry).
 */
export function getSessionHandler(req: Request, res: Response) {
  const { id } = req.params;
  const record = getSession(id);
  if (!record) return res.status(404).json({ error: "session not found" });
  return res.json(record);
}
