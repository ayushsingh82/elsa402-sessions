"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { coinbaseWallet, injected } from "wagmi/connectors";
import { useState } from "react";

const NETWORK = (process.env.NEXT_PUBLIC_NETWORK ?? "base:sepolia") as
  | "base:sepolia"
  | "base:mainnet";

const chain = NETWORK === "base:mainnet" ? base : baseSepolia;
const rpcUrl =
  process.env.NEXT_PUBLIC_BASE_RPC_URL ??
  (NETWORK === "base:mainnet" ? "https://mainnet.base.org" : "https://sepolia.base.org");

const wagmiConfig = createConfig({
  chains: [chain] as const,
  connectors: [
    injected(),
    coinbaseWallet({ appName: "elsax402", preference: "all" }),
  ],
  transports: {
    [chain.id]: http(rpcUrl),
  } as any,
  ssr: true,
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
