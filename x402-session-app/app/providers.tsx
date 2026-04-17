"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { coinbaseWallet, injected } from "wagmi/connectors";
import { useState } from "react";

const chain = baseSepolia;
const rpcUrl = "https://sepolia.base.org";

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
