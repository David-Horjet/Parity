"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { PRIVY_APP_ID } from "@/lib/config";
import { ToastProvider } from "./toast";

const connectors = toSolanaWalletConnectors({ shouldAutoConnect: true });

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
      }}
    >
      <QueryClientProvider client={queryClient}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
