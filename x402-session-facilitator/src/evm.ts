// EVM (Base / Base Sepolia) interaction helpers for the facilitator.
//
// All functions use viem v2.

import {
  createPublicClient,
  createWalletClient,
  http,
  decodeFunctionData,
  type Address,
  type Hex,
} from "viem";
import { base, baseSepolia } from "viem/chains";
import { config, facilitatorAccount } from "./config";

const ERC20_ABI = [
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
] as const;

const chain = config.chainId === base.id ? base : baseSepolia;

export const publicClient = createPublicClient({
  chain,
  transport: http(config.rpcUrl),
});

export const walletClient = createWalletClient({
  account: facilitatorAccount,
  chain,
  transport: http(config.rpcUrl),
});

// ---------- read-only ----------

/**
 * Read on-chain ERC20 allowance(owner, spender). Returns 0 if none.
 */
export async function readAllowance(
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

export async function readBalanceOf(asset: Address, account: Address): Promise<bigint> {
  return (await publicClient.readContract({
    address: asset,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [account],
  })) as bigint;
}

/**
 * Confirm the given tx hash exists, succeeded, and was an `approve(spender, value)`
 * call to the expected ERC20 contract granting at least `minValue` to `expectedSpender`.
 *
 * Throws on any mismatch.
 */
export async function assertApprovalTx(args: {
  txHash: Hex;
  expectedAsset: Address;
  expectedSpender: Address;
  expectedFrom: Address;
  minValue: bigint;
}): Promise<void> {
  const receipt = await publicClient.getTransactionReceipt({ hash: args.txHash });
  if (receipt.status !== "success") {
    throw new Error(`approval tx ${args.txHash} not successful (status=${receipt.status})`);
  }
  if (receipt.to?.toLowerCase() !== args.expectedAsset.toLowerCase()) {
    throw new Error(
      `approval tx ${args.txHash} target ${receipt.to} != expected ERC20 ${args.expectedAsset}`,
    );
  }

  const tx = await publicClient.getTransaction({ hash: args.txHash });
  if (tx.from.toLowerCase() !== args.expectedFrom.toLowerCase()) {
    throw new Error(
      `approval tx ${args.txHash} from ${tx.from} != expected ${args.expectedFrom}`,
    );
  }

  let decoded: { functionName: string; args: readonly unknown[] };
  try {
    decoded = decodeFunctionData({ abi: ERC20_ABI, data: tx.input });
  } catch (err) {
    throw new Error(
      `approval tx ${args.txHash} input does not decode against ERC20 ABI: ${(err as Error).message}`,
    );
  }
  if (decoded.functionName !== "approve") {
    throw new Error(`approval tx ${args.txHash} called ${decoded.functionName}, expected approve`);
  }
  const [spender, value] = decoded.args as [Address, bigint];
  if (spender.toLowerCase() !== args.expectedSpender.toLowerCase()) {
    throw new Error(
      `approval tx ${args.txHash} approved ${spender}, expected ${args.expectedSpender}`,
    );
  }
  if (value < args.minValue) {
    throw new Error(
      `approval tx ${args.txHash} approved ${value} < required cap ${args.minValue}`,
    );
  }
}

/**
 * Returns true if the given tx hash exists and succeeded — without checking
 * its semantic content. Used as a lightweight sanity check.
 */
export async function assertTxSuccess(txHash: Hex): Promise<void> {
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") {
    throw new Error(`tx ${txHash} not successful (status=${receipt.status})`);
  }
}

// ---------- write: transferFrom ----------

/**
 * Execute ERC20 `transferFrom(from, to, amount)` from the facilitator account.
 * Waits for receipt; throws on revert.
 *
 * The user's prior `approve(spender=facilitator, cap)` is what authorizes the pull.
 */
export async function transferFrom(args: {
  asset: Address;
  from: Address;
  to: Address;
  amount: bigint;
}): Promise<{ txHash: Hex }> {
  const txHash = await walletClient.writeContract({
    account: facilitatorAccount,
    chain,
    address: args.asset,
    abi: ERC20_ABI,
    functionName: "transferFrom",
    args: [args.from, args.to, args.amount],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") {
    throw new Error(`transferFrom ${txHash} reverted`);
  }
  return { txHash };
}

export function getNowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}
