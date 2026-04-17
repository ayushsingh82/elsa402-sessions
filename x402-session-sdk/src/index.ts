// elsa-x402-sessions
// Sign once, settle many times — session-based x402 payments on Base (EVM).

export { createSession, wrapFetch } from "./client";
export { SessionEvmScheme, SessionStellarScheme } from "./scheme-server";
export type {
  ClientSigner,
  CreateSessionOptions,
  CreateSessionRequest,
  CreateSessionResponse,
  Network,
  PaymentPayload,
  PaymentRequired,
  PaymentRequirements,
  SessionHandle,
  SessionPaymentPayloadBody,
  SupportedResponse,
} from "./types";
export {
  USDC_BASE_SEPOLIA,
  USDC_BASE_MAINNET,
  DEFAULT_DECIMALS,
  ERC20_ABI,
  chainFor,
  defaultRpcUrlFor,
  defaultUsdcFor,
  decimalToBaseUnits,
  makePublicClient,
  walletClientFromPrivateKey,
  approveERC20,
  readAllowance,
  readBalanceOf,
  getNowSeconds,
} from "./evm";
