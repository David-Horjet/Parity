"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { PRIVY_APP_ID, RPC_URL } from "@/lib/config";
import { ToastProvider } from "./toast";

const connectors = toSolanaWalletConnectors({ shouldAutoConnect: true });

// Privy's Solana signing hooks require an RPC per chain we sign for.
const rpcs = {
  "solana:devnet": {
    rpc: createSolanaRpc(RPC_URL),
    rpcSubscriptions: createSolanaRpcSubscriptions(RPC_URL.replace(/^http/, "ws")),
    blockExplorerUrl: "https://explorer.solana.com/?cluster=devnet",
  },
} as const;

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 2_000, refetchOnWindowFocus: false } } }),
  );
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        appearance: {
          theme: "#081231",
          accentColor: "#7c8cff",
          walletChainType: "solana-only",
          logo: "/parity-wordmark.svg",
          showWalletLoginFirst: true,
          walletList: ["phantom", "solflare", "backpack", "detected_solana_wallets"],
        },
        loginMethods: ["wallet", "email", "google"],
        externalWallets: { solana: { connectors } },
        embeddedWallets: { solana: { createOnLogin: "users-without-wallets" } },
        solana: { rpcs },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
