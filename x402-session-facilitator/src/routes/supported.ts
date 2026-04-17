import type { Request, Response } from "express";
import { config, facilitatorAddress } from "../config";
import type { SupportedResponse } from "../types";

export function supportedHandler(_req: Request, res: Response) {
  // Advertise both x402 v1 and v2, and both human ("base:sepolia") and CAIP-2
  // ("eip155:84532") network forms so any client codepath can find us.
  const extra = {
    areFeesSponsored: true,
    facilitatorAddress,
    spender: facilitatorAddress,
    sessionsEndpoint: "/sessions",
    chainId: config.chainId,
  };

  const networks = [config.network, config.networkCaip].filter(
    (n, i, arr) => arr.indexOf(n) === i,
  );

  const kinds = [];
  for (const network of networks) {
    kinds.push({ x402Version: 2, scheme: "session", network, extra });
    kinds.push({ x402Version: 1, scheme: "session", network, extra });
  }

  const body: SupportedResponse = {
    kinds,
    extensions: [],
    signers: {
      "evm:*": [facilitatorAddress],
      "eip155:*": [facilitatorAddress],
    },
  };
  res.json(body);
}
